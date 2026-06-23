@resolve
Feature: Resolve a short link

  Background:
    Given the test database is reset

  Scenario: Visitor resolves a short URL and analytics record a click
    Given a user has created a link for "https://example.com/target"
    When a visitor requests the short URL via the API
    Then they are redirected with status 302 to "https://example.com/target"
    And the link analytics show at least one click
