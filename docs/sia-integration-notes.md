# Sia Integration Notes

## Overview

RelayStream is evaluating Sia as a decentralized storage layer for media ingestion, archival storage, metadata coordination, and storage orchestration.

The goal is not to use Sia as a traditional centralized hosting provider. The goal is to understand how Sia can support self-hosted operators, archival media workflows, and distributed storage coordination.

## Sia Concepts Evaluated

Current testing and research includes:

- Storage contracts
- Bucket organization
- Object uploads
- Object management
- Storage usage tracking
- Developer documentation
- Indexer-based workflows
- Long-term decentralized storage considerations

## RelayStream Workflow

The proposed RelayStream Open Ingestion Engine is intended to support a workflow like this:

Source Media
↓
FFmpeg Processing
↓
HLS Manifest + Segments
↓
Storage Organization
↓
Sia Storage / Other Storage Providers
↓
Metadata Mapping
↓
Playback / Retrieval Coordination

## Why Sia Matters

Sia is being evaluated because it supports user-owned decentralized storage infrastructure.

RelayStream is specifically interested in:

- Operator-controlled storage
- Redundant decentralized storage
- Long-term archival workflows
- Storage independence
- Media preservation
- Retrieval coordination

## Current Development Stage

RelayStream is currently in prototype and architecture development.

Current public work includes:

- Open-STRM coordination concepts
- Metadata mapping
- Media registration experiments
- HLS ingestion proof workflows
- Sia Storage evaluation
- Decentralized storage research

## Next Development Goals

Planned next steps include:

- Building Sia-aware upload workflow prototypes
- Expanding storage orchestration tooling
- Creating clearer media manifest structures
- Improving metadata-to-storage mapping
- Documenting self-hosted deployment workflows
