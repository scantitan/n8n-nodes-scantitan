# n8n-nodes-scantitan

Maintainer and support: info@scantitan.com. Never send credentials or private scan evidence by email.

ScanTitan community nodes for website owners, developers, agencies, enterprise teams, MSPs and MSSPs.

## Setup
Add and verify websites in ScanTitan, select a plan, then create an **n8n** credential under **Account & plan → Connected apps**. Store it in n8n's ScanTitan API credential. Choose assets:read, scans:read, scans:run, monitoring:read and events:read as needed.

The ScanTitan node lists and adds websites, verifies ownership, starts or cancels scans, gets status, retrieves paginated findings and shows plan-included monitoring. Each output is the complete API response in one item: data plus pagination metadata. Get Findings returns one page; increment Page through meta.last_page. A scan must be Completed before retrieving findings; use Get Scan with an n8n Wait loop first.

Adding websites requires assets:create and explicit authorization. Website ID selects an existing bound website whose customer will own the new site. New sites join this connection, count toward the plan allowance and start with monitoring off and ownership unverified. The connector cannot enroll an existing unselected site; select it in a new connection from the portal instead. Use Get Ownership Proof and Verify Website to check DNS or file proof. No scan runs before ownership is verified.

Import the three JSON files in examples, select your ScanTitan credential in each ScanTitan node, and replace the website ID in the start-scan example. The completion example retrieves the first 100 findings and returns pagination metadata; add a loop through meta.last_page when you need every finding. The notification example prepares a message payload without sending it to an external service; attach your chosen notification/ticket node and deduplicate on deduplication_key.

Start Scan requires a 1–120 character idempotency key. Use a stable deployment or job identifier on retries. Requests use the existing scan settings and allowance. A completed scan with coverage_complete=false or demo=true is not a completed real assessment.

The polling trigger supports scan.completed, finding.opened/updated/resolved and monitor.alert.opened/updated/resolved. The first automatic poll establishes a cursor without replaying history. Manual tests read events since connection creation without advancing the saved cursor. A new installation credential resets the cursor; rotation retains the installation. It reads up to 2,000 events per poll and resumes the rest next time. Cursor updates occur only after successful retrieval of all pages in that poll. n8n persists workflow static data on successful production execution; downstream failures may cause replay. Deduplicate ticket creation on event.id. A failed or incomplete assessment never resolves missing findings.

## Development
Node 24; npm ci; npm run build; npm run lint; npm test.
No external runtime dependencies, file access or environment access in the nodes. The API URL defaults to ScanTitan Cloud. Use your deployment's HTTPS integration API address for staging or self-hosted use. HTTP URLs, embedded credentials, query parameters and fragments are rejected. Credentials are restricted to the configured origin and redirects are disabled, including credential tests.

The ScanTitan Cloud connected-app service is live. This package is not yet published on npm or verified by n8n. Public source: https://github.com/scantitan/n8n-nodes-scantitan. Publication runs through GitHub Actions with npm provenance; n8n Cloud discovery requires approval through the n8n Creator Portal.

The public repository's .github/workflows/publish.yml runs the official n8n release command, then scans the published package and its provenance in a separate job. Configure the npm-release environment and npm trusted publisher with direct publish permission. A new npm package needs its first publication from this workflow before trusted publishing can be configured; use a temporary, appropriately scoped bootstrap credential if required, then remove it after trusted publishing succeeds. No publisher credentials are included in this package.

Official requirements: https://docs.n8n.io/connect/create-nodes/build-your-node/reference/verification-guidelines.md

