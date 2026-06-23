# Agents

This document describes the AI/automation agent concept in Detox OS Dashboard.

## Purpose

Agents represent automated or semi-automated operational workflows for Detox.no.

Examples:

- ROAS monitoring
- invoice collection
- stock alerts
- SEO checks
- customer service helpers
- data quality checks

## Suggested data model

An agent record should describe:

- ID
- name
- type/category
- description
- status
- schedule
- last run
- next run
- runs today
- success rate
- average duration
- last message

## Status examples

- running
- inactive
- error
- scheduled
- paused

## Operational principles

- Agents should be observable.
- Every agent should have a clear owner or business purpose.
- Failed agents should show a useful last message.
- Risky automations should start as recommendations, not direct actions.
- Agent status should be easy to understand for non-technical operators.

## Future improvements

- Add agent detail pages.
- Add run logs.
- Add manual retry controls.
- Add severity levels.
- Add links to related SOPs.
- Add audit history for agent-triggered actions.