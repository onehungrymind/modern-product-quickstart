terraform {
  required_version = ">= 1.6.0"
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

# Docker Desktop on macOS exposes the socket under $HOME, not /var/run. Pass via
# -var or DOCKER_HOST (the provider also reads DOCKER_HOST).
variable "docker_host" {
  type    = string
  default = "unix:///var/run/docker.sock"
}

# Build-once / promote-the-same-image: the API + web images are built ONCE
# (deploy/*.Dockerfile, or CI) and Terraform references them by tag. Promotion to
# prod re-applies the SAME image tag (see deploy/promote.mjs) — no rebuild.
variable "api_image" {
  type    = string
  default = "tracer-api:dev"
}
variable "web_image" {
  type    = string
  default = "tracer-web:dev"
}

variable "jwt_secret" {
  type    = string
  default = "infra-local-jwt-secret-32-characters"
}

# dev + prod parity: identical topology, only names/ports differ by workspace.
variable "env_ports" {
  type = map(object({ api = number, web = number, db = number }))
  default = {
    dev   = { api = 13000, web = 14200, db = 15432 }
    prod  = { api = 13001, web = 14201, db = 15433 }
    probe = { api = 13002, web = 14202, db = 15434 } # used by the readiness check in isolation
  }
}

provider "docker" {
  host = var.docker_host
}

locals {
  env   = terraform.workspace == "default" ? "dev" : terraform.workspace
  ports = var.env_ports[local.env]
  name  = "tracer-${local.env}"
}

resource "docker_network" "net" {
  name = "${local.name}-net"
}

resource "docker_image" "postgres" {
  name         = "postgres:16-alpine"
  keep_locally = true
}

resource "docker_image" "api" {
  name         = var.api_image
  keep_locally = true
}

resource "docker_image" "web" {
  name         = var.web_image
  keep_locally = true
}

resource "docker_container" "db" {
  name     = "${local.name}-db"
  image    = docker_image.postgres.image_id
  hostname = "${local.name}-db"
  env      = ["POSTGRES_USER=tracer", "POSTGRES_PASSWORD=tracer", "POSTGRES_DB=tracer"]
  networks_advanced {
    name = docker_network.net.name
  }
  ports {
    internal = 5432
    external = local.ports.db
  }
  healthcheck {
    test     = ["CMD-SHELL", "pg_isready -U tracer"]
    interval = "5s"
    timeout  = "5s"
    retries  = 5
  }
}

resource "docker_container" "api" {
  name  = "${local.name}-api"
  image = docker_image.api.image_id
  env = [
    "DATABASE_URL=postgres://tracer:tracer@${local.name}-db:5432/tracer",
    "JWT_SECRET=${var.jwt_secret}",
    "NODE_ENV=production",
    "URL_PREVIEW=stub",
    "CORS_ORIGINS=*",
  ]
  networks_advanced {
    name = docker_network.net.name
    # The web container's nginx proxies /api → http://api:3000.
    aliases = ["api"]
  }
  ports {
    internal = 3000
    external = local.ports.api
  }
  # The image self-migrates on boot; restart-on-failure rides out the DB warmup race.
  restart    = "on-failure"
  max_retry_count = 10
  depends_on = [docker_container.db]
}

resource "docker_container" "web" {
  name  = "${local.name}-web"
  image = docker_image.web.image_id
  networks_advanced {
    name = docker_network.net.name
  }
  ports {
    internal = 80
    external = local.ports.web
  }
  depends_on = [docker_container.api]
}

output "environment" {
  value = local.env
}
output "api_image" {
  value = var.api_image
}
output "api_url" {
  value = "http://localhost:${local.ports.api}/api/health"
}
output "web_url" {
  value = "http://localhost:${local.ports.web}"
}
