# Web-OS Platform - Complete Plan

## MVP Overview

1. Project structure
2. How client communicate with server (the trait interface)
3. How can we switch client with eases

## Initial MVP Implementation

- Filesystem
- Chat group
- They can talk

- Frontend won't be splitted into microservices but we need some versions system: 
    which frontend works with with backend interfaces

## Filling in

Technical of each:
- Collaborative editing conflict resolution for examples

## Deployment

## Trait-based FE/BE Versioning (Agnostic-FE-BE)

How it works:

Trait based implementation (Composition over Inheritance):  

A backend service implement certain Traits (API) 

User can pick different frontends version even without authentication 

A frontend version must specify its compatible backend traits before

## Advanced Features

- Each service include its own frontend and backend
- Main web shell:
  - Registration of each service (think of them like an app)
  - Manage interaction between services
  - Monitoring running stats
  - Have the capacbilities to enable/disable service or swap frontend/backend in runtime
  - Load testing that works ON THE BROWSER

- Flagging/Configuration or whatever methodology for plug in/out service safely.
For e.g: frontend A.1 is only compatible with backend B.2
Suggestion: flags array for example frontend A requires backend with at least [a,b,c], and full list is [a,b,c,d,e,f] => backend must have [a,b,c]. Other features frontend need but backend don't have can be acceptable (gracefully handle)
Suggestion: learn more about flagging
Suggestion: take a look at WebOS to see what it really is
https://github.com/HeyPuter/puter?tab=readme-ov-file
