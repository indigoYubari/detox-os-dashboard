# Pipelines

Pipelines represent recurring data or operational workflows in Detox OS Dashboard.

## Purpose

Pipeline monitoring helps Detox.no understand whether automated workflows are running successfully.

Examples:

- ad data sync
- Shopify to accounting reconciliation
- Klaviyo segment sync
- SEO checks
- inventory updates
- supplier documentation checks

## Suggested data model

A pipeline record should describe:

- ID
- name
- description
- trigger
- status
- last run
- duration
- throughput
- success rate
- stages

## Stage model

Each pipeline can contain stages:

```text
1. Fetch
2. Normalize
3. Store
4. Report
```

Each stage should have a status such as:

- ok
- waiting
- error
- skipped

## Operational principles

- Make failures visible.
- Show which stage failed.
- Preserve the last successful run.
- Track success rate over time.
- Link failed pipelines to troubleshooting documentation.

## Future improvements

- Add pipeline detail pages.
- Add run history.
- Add retry buttons.
- Add alerting for repeated failures.
- Add owner/responsibility field.
- Link each pipeline to relevant SOPs.