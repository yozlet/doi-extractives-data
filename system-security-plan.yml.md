---
name: The United States Extractives Industries Transparency Initiative (USEITI)
uniqueID: MB18FONRR2016
version: .9.0
phase: beta
information-types:
- D26 Civilian Operations
confidentiality: none
integrity: low
availability: low
security-baseline: open data
system-type: minor
level-of-identity-assurance: 0
staff:
    authorizing-official:
        name: Aaron Snow
        title: 18F Executive Director 
        org: General Services Administration
        unit: 18F
        email: 18F@gsa.gov
    system-owner: 
        name: Noah Kunin
        title: 18F Infrastructure Director
        org: General Services Administration
        unit: 18F
        email: devops@gsa.gov
    system-management:
        name: Noah Kunin
        title: 18F Infrastructure Director
        org: General Services Administration
        unit: 18F
        email: devops@gsa.gov
    system-security-officer:
        name: Noah Kunin
        title: 18F Infrastructure Director
        org: General Services Administration
        unit: 18F
        email: devops@gsa.gov
    technical-lead:
        name: Brian Hedberg
        title: Technical Lead
        org: General Services Administration
        unit: 18F
        email: Brian.Hedberg@gsa.gov
leveraged-authorizations: 
- https://www.fedramp.gov/marketplace/compliant-systems/amazon-web-services-aws-eastwest-us-public-cloud/
purpose: https://github.com/18F/doi-extractives-data#why
components: 
- https://github.com/18F/doi-extractives-data
- https://github.com/18F/federalist
- https://github.com/18F/beckley
diagram: https://drive.google.com/a/gsa.gov/file/d/0BynIxtx-CfkdNm85eWdsdHBMT2c/view
network-architecture: n/a
environments:
- cloud.gov
- Amazon Web Services East / West
user-types:
    developer:
        functions: 
        - deployment
        - engineering
controls: https://github.com/18F/federalist#getting-started
---