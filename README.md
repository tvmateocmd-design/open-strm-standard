# RelayStream Open-STRM Standard

RelayStream is an open-source framework for decentralized media coordination, storage orchestration, metadata indexing, and media discovery.

## Verified prototype milestone — November 2026

The [three-provider failover demo](demos/three-provider-failover/README.md) now includes the working Node.js gateway, Windows launcher, browser dashboard, integrity inventory, automated tests, and exported playback evidence.

- One playback URL routes VOD retrieval across **Sia → Storj → Lighthouse**.
- All 15 media objects are checked against saved SHA-256 hashes before delivery.
- Two recorded Windows runs completed sequential gateway-simulated outages with no browser-recorded stalls. These are controlled demonstrations, not network-wide outage tests or production guarantees.
- Separately, live HLS delivery was demonstrated on desktop and Android Chrome over cellular using FFmpeg, a Python server, and Cloudflare Tunnel. That live pipeline is separate from this VOD gateway; its private feed credentials and broadcast recordings are not included here.
- Solana rights coordination and a reusable Open-STRM-driven gateway remain development work. The failover demo performs no blockchain transactions.

This code predates the Eternal sprint and is documented as its starting baseline. See the [evidence and limitations](demos/three-provider-failover/evidence/README.md).

## Overview

The Open-STRM Standard is being developed to explore how decentralized storage networks, metadata systems, and media applications can work together through a unified coordination layer.

RelayStream focuses on:

* Media ingestion workflows
* Metadata management
* Storage orchestration
* Decentralized media discovery
* NFT-linked media assets
* Open infrastructure standards

## Current Development Areas

### Storage Research

RelayStream is actively evaluating decentralized storage technologies including:

* Sia Storage
* Storj
* Filecoin
* 0G

### Media Ingestion

Current prototype development includes:

* FFmpeg-based media ingestion
* HLS packaging workflows
* Media asset organization
* Metadata generation

### Media Coordination

Research is focused on:

* Asset indexing
* Storage mapping
* Retrieval coordination
* Open metadata standards

## Repository Contents

This repository contains prototype code, architecture experiments, metadata workflows, and development materials related to the RelayStream project.

Current files include:

* Metadata generation tools
* Asset registration experiments
* Stream registration workflows
* Open-STRM prototype components

## Review Materials

### Sia Storage Proof Demo

Documentation related to the RelayStream Sia Storage proof-of-work demonstration can be found here:

- demos/sia-storage-proof/README.md

This material documents hands-on evaluation of Sia Storage including contracts, buckets, object uploads, storage organization, and review of Sia developer tooling.

### HLS Ingestion Workflow

Example ingestion workflow documentation can be found here:

- demos/hls-ingestion-proof/ffmpeg-hls-example.ps1

This example demonstrates the type of FFmpeg-based processing used to generate HLS manifests and segmented media output.

### Sia Integration Notes

Architecture notes regarding Sia evaluation and integration can be found here:

- docs/sia-integration-notes.md

These notes describe how decentralized storage is being evaluated within the RelayStream Open Ingestion Engine architecture.


## Project Status

Active Development

## Website

https://relaystream.org

## GitHub Owner

Michael Lipson
VAL IT Tech Solutions

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for the full terms.

Copyright 2026 Val IT Tech Solutions, LLC, subject to confirmation of the ownership of individual contributions. The Apache 2.0 license does not grant trademark rights to the RelayStream or Open-STRM brands.

