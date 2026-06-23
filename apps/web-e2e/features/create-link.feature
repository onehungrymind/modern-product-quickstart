@create
Feature: Create a short link

  Background:
    Given the test database is reset

  Scenario: Registered user creates a short link and sees it in their list
    Given a user is registered and logged in
    When they create a link for "https://example.com/docs"
    Then the link appears in their links list
    And a short URL is shown for the link
