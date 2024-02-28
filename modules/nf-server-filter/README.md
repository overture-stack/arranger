# Nextflow Arranger Server

### Overview

This arranger server acts as a proxy to obtain nextflow workflow updates.

### Prerequisites

NodeJs version: `v14.21.0`; NPM version: `6.14.17`. Recommended to use node version manager (NVM).

### Installation

1. `cd nf-server-filter`
2. `npm install`

### Start up

1. Set `.env` to point to desired server port, arranger project ID, and elasticsearch instance.
2. Run `node server.js`

### Important notes

1. Export-to-file logic exists under `/export`.
