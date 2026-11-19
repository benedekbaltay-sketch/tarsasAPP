# Project Context — Shared Residential Property / Condominium Management Platform

> **Purpose of this file:** This is the persistent high-level context for the project. A new development agent should read this file before making product, UX, architecture, database, or implementation decisions. It explains what the product is, why it exists, the conceptual model, the intended user experience, and the principles that should remain stable as the application evolves.
>
> This is intentionally **not** a complete technical specification. Exact schemas, screens, APIs, calculations, permissions, and implementation details should be developed later from this context and from subsequent requirements.

---

# 1. Executive Summary

The project is a web application for managing and presenting information about residential buildings/properties that contain multiple individually owned apartments.

The initial real-world use case is a single house/building with several apartments and owners. However, the product is being designed from the beginning so that it can eventually support multiple buildings, different representatives, users with apartments in several buildings, different ownership structures, and different financial/organizational arrangements.

The most important purpose of the application is **simplicity and transparency for apartment owners**.

An owner should not need to understand the entire administration of a building in order to use the application. When they open it, the most important information should be immediately clear:

1. **What do I need to pay?**
2. **How much do I need to pay?**
3. **Where do I need to send the money?**
4. **Have I paid everything / what is the financial status of my apartment?**

The owner can then navigate to more detailed information when desired, such as their apartment's financial history, the building's financial situation, loans, and documents.

The central operational principle is:

> **The representative maintains the building's core records; owners primarily view, understand, and monitor the information recorded for them.**

This is therefore primarily a **transparency and information platform**, not a collaborative platform in which every owner actively manages the building.

---

# 2. Product Vision

The product should make shared-property administration feel simple for owners even when the underlying legal, financial, and organizational situation is complicated.

A building can have many owners, different contribution rules, multiple financial accounts, loans, renovation projects, common expenses, documents, and periodic financial reporting. Owners should not have to manually reconstruct this information from bank transfers, emails, paper documents, or conversations with the representative.

The application should provide one clear place where the information maintained by the representative can be understood.

The product should therefore combine:

- A simple owner-facing financial dashboard
- Apartment-specific financial history
- Building-level financial transparency
- Financial account information
- Loan information
- Building documents
- Representative-managed records
- Support for multiple apartments per person
- Support for multiple buildings
- A platform-level IT manager
- Hungarian and English language support

The application should be deliberately **simple on the surface while remaining flexible underneath**.

---

# 3. Initial Scope vs. Long-Term Scope

## 3.1 Initial real-world use case

The first practical use case is:

- One building/house
- Several apartments
- Several owners
- One representative (`közös képviselő`)
- Building-level shared financial matters
- Apartment-level financial obligations and payment history
- Building documentation
- Building financial transparency

## 3.2 Intended long-term product

The application should be capable of expanding to:

- Multiple buildings
- Different representatives for different buildings
- Users owning multiple apartments
- Users owning apartments in different buildings
- Apartments with multiple owners
- Representatives who are also owners
- Different numbers/types of financial accounts per building
- Different contribution rules per building
- Additional organizational roles
- Building-level loans involving only some apartments/owners
- Cash and other financial holdings
- More sophisticated financial reporting and accounting

The first version should not unnecessarily implement every future feature, but the underlying conceptual model should avoid making these future cases impossible.

---

# 4. Core Conceptual Model

The most important conceptual entities are:

- **User** — a person with an application account, identified primarily through an email/account identity.
- **Building** — a residential property/house managed as a shared property context.
- **Apartment** — an individually identifiable unit within a building.
- **Ownership relationship** — the relationship connecting a user to an apartment. This should not be assumed to be one-to-one.
- **Representative** — the person responsible for managing the building's core records (`közös képviselő`).
- **Financial account/source** — a building-level place where money is held or managed, such as a bank account or potentially cash.
- **Charge / contribution / obligation** — an amount an apartment is required to pay.
- **Payment** — an amount actually paid.
- **Expense** — money spent by the building.
- **Loan** — a building-level loan that may involve only some apartments/owners.
- **Document** — a building-related file/document managed by the representative.
- **Financial report/accounting information** — information used to provide periodic transparency about building finances.
- **Role / permission** — authorization defining what a user can see or change.

The exact database model is not defined by this document. These are conceptual entities that should guide later technical design.

---

# 5. Ownership Model

Do **not** assume a simple one-user-to-one-apartment relationship.

The application needs to be able to represent situations such as:

### Example A — normal ownership

One user owns one apartment.

### Example B — one person owns multiple apartments

One user owns several apartments in the same building.

### Example C — one person owns apartments in different buildings

The same user account/email can be connected to apartments belonging to multiple buildings.

### Example D — multiple owners of one apartment

An apartment can potentially have multiple owners.

### Example E — representative is also an owner

The person acting as the representative of a building can simultaneously own one or more apartments in that building.

Therefore, ownership should conceptually be modeled as a **relationship**, not as a direct property of a user or a one-to-one assignment.

A useful conceptual relationship is:

`User ↔ Ownership Relationship ↔ Apartment ↔ Building`

The exact ownership attributes (for example ownership percentages) are not yet specified and should be determined later if required.

---

# 6. User Identity Across Buildings

A user's email/account is important because it provides the connection between the same person and their apartments across different buildings.

For example, the same account may have:

- Apartment 2 in Building A
- Apartment 7 in Building A
- Apartment 14 in Building B

The application should therefore have a clear concept of the **user's overall property access**, while maintaining strict separation between individual building and apartment contexts.

The user should never be uncertain about which apartment/building they are currently viewing.

---

# 7. Buildings

A building is the primary management and financial context.

Each building can have its own:

- Apartments
- Ownership relationships
- Representative
- Financial accounts
- Contribution rules
- Charges
- Payments
- Expenses
- Loans
- Documents
- Financial reporting/accounting information
- Additional roles/permissions

The application must not assume that two buildings necessarily operate in exactly the same way.

Different buildings can establish different rules and structures.

---

# 8. Representative (`Közös Képviselő`)

The primary manager of a building is the **közös képviselő**, referred to as the **representative** in English.

There is currently one representative responsible for each building.

The representative is the primary person who maintains the building's core information and records.

Conceptually, the representative is responsible for functions such as:

- Managing apartment information
- Managing ownership information
- Managing core building information
- Determining/settting apartment contribution obligations
- Recording payments
- Recording expenses
- Managing financial account information
- Managing loan information
- Uploading/managing documents
- Maintaining financial records
- Supporting periodic financial accounting/reporting to owners

The exact set of representative tools will be determined during implementation.

Important: the application should not hard-code the assumption that the representative is the owner, or that the representative is never an owner. Both situations must be possible.

---

# 9. Additional Building Roles

Hungarian condominium/property structures can involve roles or bodies beyond the representative. One example is the **számvizsgáló bizottság**, and there can also be other decision-making participants with distinct responsibilities.

These roles are not yet fully specified.

However, the architecture and authorization model should **not** assume that the only roles in existence are:

- Owner
- Representative

The product should be capable of supporting additional roles and permissions later.

Possible future roles may include supervisory/audit or decision-making roles, but their exact capabilities should be defined when requirements are known.

---

# 10. Platform IT Manager

There is also a platform-level role referred to as the **IT manager**.

The IT manager is fundamentally different from the representative.

### Representative

Manages the information and finances of a specific building.

### IT manager

Manages/supports the platform as a whole.

The IT manager should be able to see platform-level information such as:

- Number of buildings using the system
- Which representative is associated with each building
- Which apartments belong to each building/representative
- Relevant account information needed to provide technical support

The IT manager may need the ability to access user accounts for troubleshooting when something is not working.

The IT manager's role is primarily **platform administration and technical support**, not routine financial management of individual buildings.

Exact impersonation/support capabilities and security controls are not yet defined and should be designed later.

---

# 11. Permission Philosophy

The permission model is one of the core concepts of the application.

## 11.1 Owners

Owners are primarily read-only users.

They can view information made available to them, especially:

- Their apartment's obligations
- Their apartment's payment history
- Their apartment's financial position
- Relevant building financial information
- Building account balances
- Building loans
- Building documents
- Financial reporting/accounting information

They should generally **not** be able to modify core building records.

There are limited exceptions for personal information, such as allowing a user to update their own phone number or other permitted profile/contact details.

General rule:

> **Owners may update a small set of their own personal information, but they do not manage the building's core records.**

## 11.2 Representative

The representative is the main editor/manager of building records:
- Manages condominium core master data (**Elnevezés / Name** and **Adószám / Tax Number**) directly within the Representative Profile.
- Manages representative contact information (phone, email).
- Manages apartments, owners, financial balances, transactions, expenses, documents, and information tiles (with clean collapsible case overviews and 1-click clipboard data copying for headers and details).

## 11.3 IT Manager / SuperAdmin (`role === "superadmin"`)

The SuperAdmin (Rendszergazda) has platform-wide visibility and administrative capabilities:
- **Interactive Hierarchy Tree Diagram**: Visualizes which Condominium Representatives manage which condominiums, and inspects all flats branching out from each representative.
- **Full Email Transparency**: Lists all email addresses attached to each apartment (including individual owner emails and secondary email lists) with 1-click clipboard copying.
- **Safe Act-As Impersonation**: Seamlessly enters any representative or resident profile to troubleshoot, calibrate, or edit data directly as if logged in as that user, with a dedicated sticky floating banner providing an immediate 1-click return to the SuperAdmin Center.
- **Multi-Condominium Scalability**: Accommodates any number of representatives and apartments through search filtering, branch collapse/expansion, and tabular matrix views.

## 11.4 Future roles

The authorization model should be extendable so that additional building roles can have distinct permissions.

---

# 12. Financial System — General Principle

The application should not impose a universal financial structure on every building.

The original example has two accounts:

1. A normal/common-expense account
2. A renovation account

But this is **only one possible configuration**.

Another building may have:

- One account
- Two accounts
- Several bank accounts
- A renovation/reserve account
- Special-purpose accounts
- Cash
- Other financial sources

Therefore, the system should conceptually support an **arbitrary/flexible set of financial accounts or financial sources per building**.

The purpose, role, and rules associated with those accounts can vary between buildings.

Do not hard-code the product around exactly two accounts.

---

# 13. Contribution / Obligation Model

Different buildings can use different methods for determining how much each apartment should contribute.

There is intentionally **no single universal contribution calculation** built into the concept.

A building may use rules based on things such as:

- Fixed apartment-specific amounts
- Ownership arrangements
- Apartment characteristics
- A building-specific calculation
- Other rules defined by the building

The exact rules are not yet specified.

The key product principle is:

> **The representative determines the contribution obligation for each apartment according to the rules of that building.**

The application primarily records, communicates, and tracks the obligation.

It should not assume that it can automatically calculate every building's contribution without representative-defined rules.

---

# 14. Charges vs. Payments

The system should conceptually distinguish between a **charge/obligation** and an actual **payment**.

### Charge / obligation

Represents what an apartment is required to pay.

### Payment

Represents what was actually paid.

This distinction allows the system to communicate concepts such as:

- Required amount
- Amount paid
- Remaining/outstanding amount
- Potential overpayment/credit
- Historical fulfillment of obligations

The detailed accounting logic is not yet defined and should be implemented only after the relevant financial rules are established.

---

# 15. Payments

In the initial operational concept, the representative checks the relevant bank account(s) and records payments in the application.

The important product concept is that **payments are recorded by the responsible representative rather than being entered/edited by ordinary owners**.

The application therefore acts as the authoritative presentation of the records maintained by the representative.

Whether payments will eventually be imported or matched automatically through bank integrations is not yet defined and should remain an implementation/future-feature question.

---

# 16. Apartment Financial History

The apartment's financial history is one of the most important parts of the owner experience.

An owner should be able to see the financial history associated with their apartment rather than having to inspect the entire building's transaction history.

Conceptually, this history may contain:

- Historical charges/contributions
- Payments made
- Outstanding amounts
- Changes to financial obligations
- Other relevant apartment-level financial events

The purpose is to let the owner answer:

> **Have I paid everything that I was supposed to pay, and what has happened financially with my apartment over time?**

The exact history model and retention rules should be defined later.

---

# 17. Building Expenses

The representative needs to maintain information about money spent by the building.

Expenses can relate to common building matters such as maintenance, insurance, renovation, services, or other building-level costs.

Owners do not need to manage these expenses.

The application should support the representative in recording and presenting the information necessary for building financial transparency and periodic accounting.

The owner-facing experience should not necessarily expose a live, raw bank-transaction stream.

Instead, building-level spending information can be presented through appropriate financial views and periodic reporting/accounting functionality.

The detailed expense model is intentionally left for later development.

---

# 18. Building Financial Transparency

Although the owner-facing experience prioritizes the owner's apartment, owners should also be able to access important information about the overall financial situation of the building.

This includes, conceptually:

- Account balances
- Loans
- Relevant building financial information
- Periodic financial accounting/reporting information

The application should balance **transparency with usability**.

Owners do not necessarily need to see every building transaction in real time.

The intended principle is:

> **Owners should have meaningful access to the financial situation of the building and the information required for transparency, without turning the primary owner interface into a raw accounting ledger.**

The exact distinction between public-to-owners, restricted, and representative-only financial information should be defined later.

---

# 19. Financial Reporting / Accounting

A representative periodically needs to account for how the building's money has been used.

The application should support this responsibility.

The product can eventually provide structured financial reporting/accounting information containing concepts such as:

- Income/contributions
- Expenses
- Account balances
- Loans
- Relevant supporting documents
- Other building financial information

At the concept stage, this should be understood as a **transparency/reporting capability**, not as a fully specified accounting software package.

Detailed reporting periods, report formats, calculations, approval workflows, and legal requirements should be defined later.

---

# 20. Cash

Some buildings may handle cash in addition to bank accounts.

The system should therefore not conceptually assume that all building money exists exclusively in bank accounts.

Cash can eventually be modeled as another financial source/account-like object.

The exact implementation and cash-management workflow are not yet defined.

---

# 21. Building Loans

The application should support loans taken by the **building/house** from a bank or other financial institution.

This is not intended to be a general personal-loan management system.

A relevant use case is a building renovation where some owners cannot pay their renovation contribution immediately. A group of owners may participate in a loan that is handled and managed at the building level.

Therefore:

- A loan belongs conceptually to a building.
- A loan may involve only some apartments/owners.
- Not every apartment in the building necessarily participates in a given loan.
- The building/representative manages the relevant loan information.
- Owners should be able to see relevant loan information according to their permissions.

The detailed loan data model is intentionally not defined yet.

---

# 22. Documents

The application should provide a centralized repository for building-related documents.

Documents are primarily uploaded and managed by the representative.

Potential document types include:

- Insurance documents
- Loan documents
- Renovation documents
- Contracts
- Financial documents
- Building administration documents
- Other official building documentation

The owner primarily consumes these documents and does not manage the repository.

The exact folder/category system, metadata, document permissions, and apartment-specific document handling can be designed later.

The initial conceptual model is:

`Building → Documents`

with the possibility of associating specific documents with an apartment, loan, project, or other entity later if required.

---

# 23. Owner Dashboard

The dashboard is the most important user-facing screen/concept.

When an owner opens the application, the system should prioritize the information they need most immediately.

The primary question the dashboard should answer is:

> **What do I need to do financially right now?**

The primary information hierarchy should therefore emphasize:

1. Amount currently required / owed
2. What the payment relates to
3. Where the money should be sent
4. Payment status / financial position
5. Access to apartment history

The dashboard should not be overloaded with secondary building information.

More detailed information should be available through navigation.

The owner should not have to navigate through multiple financial screens just to discover their current payment obligation.

---

# 24. Information Architecture — Conceptual

The exact navigation is not yet fixed, but the product concept naturally contains several areas.

A possible conceptual structure is:

- **Dashboard** — immediate payment/obligation information
- **Apartment / My apartment** — apartment-specific information and financial history
- **Building finances** — broader building financial situation
- **Loans** — building loan information
- **Documents** — building document repository
- **Profile** — user's personal/account information
- **Apartment/building switcher** — when the user has multiple apartments/buildings

This is a conceptual information architecture, not a mandatory final UI structure.

---

# 25. Apartment Context Switching

A user may have multiple apartments, potentially across different buildings.

The application therefore needs a clear context-switching concept.

For example, a user could have:

- Building A — Apartment 4
- Building A — Apartment 8
- Building B — Apartment 12

When the user selects an apartment, apartment-specific information should update to reflect that apartment.

The user must not accidentally see the financial history or obligations of one apartment while believing they are viewing another.

The selected apartment/building context should therefore be visually clear throughout the application.

A future overview of all apartments owned by the user may also be useful, but it is not a requirement to define in detail at this stage.

---

# 26. Profile

Users should have a profile/account area.

The profile can contain information about the user and their relationship with the application.

Some personal information may be editable by the user, such as a phone number.

The user's access to apartments/buildings should be represented through the ownership/access relationships rather than being manually duplicated as unrelated profile data.

Exact profile fields are not yet defined.

---

# 27. Language and Localization

The application must support:

- **Hungarian**
- **English**

The user should be able to switch language through a language control/button.

Internationalization should be considered a first-class requirement from the beginning.

All user-facing application text should be designed to support translation, including:

- Navigation
- Buttons
- Labels
- Headings
- Financial terminology
- Notifications
- System messages
- Validation messages
- Errors
- Other generated interface text

The application should not be architected in a way that makes later translation unnecessarily difficult.

Hungarian terminology is especially important because the initial domain is closely connected to Hungarian condominium/property-management practices.

---

# 28. Key UX Philosophy

The UX should follow these principles.

## 28.1 Simplicity first

Owners should be able to use the application without needing technical or accounting knowledge.

## 28.2 Immediate usefulness

The first screen should provide the information owners most frequently need.

## 28.3 Progressive disclosure

Detailed information should be available, but it should not overwhelm the primary dashboard.

## 28.4 Clear financial status

Owners should be able to understand whether they have paid what they are required to pay.

## 28.5 Transparency without noise

Owners should have access to meaningful building information without being forced to navigate through every internal administrative transaction.

## 28.6 Clear ownership/building context

When users have multiple apartments or buildings, context must always be obvious.

## 28.7 Read-only by default for owners

Owners should primarily inspect records rather than modify them.

## 28.8 Flexible underlying model

The UI can remain simple while the underlying data model supports different buildings and organizational structures.

---

# 29. Important Product Distinction

This application should **not** be understood simply as a shared bank-account viewer.

The building's financial accounts are one part of the system, but the product's central value is the relationship between:

- The apartment
- Its obligations
- Its payments
- Its financial history
- The building's finances
- The representative's records
- The building's documents and loans

The owner should primarily experience the application through their **apartment context**, not through the building's raw accounting data.

---

# 30. What the Application Is Not

Unless future requirements explicitly change the direction, the application is not primarily intended to be:

- A social network for residents
- A discussion/forum platform
- A collaborative task-management system where owners manage the building themselves
- A general personal banking application
- A general personal-loan application
- A full accounting ERP system
- A real-time bank transaction viewer for every owner

These distinctions help prevent feature creep and preserve the core product purpose.

---

# 31. Data Authority / Source of Truth Principle

The representative is the primary operational source for the building's managed records within the application.

Owners should generally trust the information presented to them as the records maintained by the representative.

This does not mean the system should ignore auditability or corrections. Rather, it means that ordinary owners are not expected to directly edit the underlying building records.

Future development may introduce audit logs, correction workflows, approvals, or other controls where appropriate.

---

# 32. Security and Separation of Data

Because the application contains financial and property information, separation between buildings, apartments, and users is fundamental.

A user should only have access to apartments/buildings to which they are authorized.

Information belonging to different buildings must not accidentally leak into another building's context.

The exact technical security architecture is not defined here, but future implementation must treat authorization and data isolation as core requirements rather than optional UI behavior.

---

# 33. Extensibility Principles

The application should be designed so that future development can introduce new building structures without rewriting the entire product.

Important examples of flexibility:

### Ownership flexibility

Do not assume one apartment = one owner.

### Building flexibility

Do not assume there is only one building in the system.

### Representative flexibility

Do not assume the same representative manages every building.

### Financial-account flexibility

Do not assume every building has exactly two accounts.

### Contribution flexibility

Do not assume all buildings calculate contributions in the same way.

### Role flexibility

Do not assume only owners and representatives exist.

### Loan flexibility

Do not assume every loan applies to every apartment.

### Financial-source flexibility

Do not assume all money is held in bank accounts.

These are not necessarily features that all need to be implemented immediately. They are constraints on the conceptual design so that the first implementation does not create unnecessary structural limitations.

---

# 34. Current Non-Goals / Intentionally Undecided Areas

This context document should **not** be treated as a final specification for:

- Exact database tables/fields
- Exact UI designs
- Exact page count
- Exact navigation labels
- Exact contribution formulas
- Exact accounting formulas
- Exact financial calculations
- Exact loan calculations
- Exact document categories
- Exact legal compliance implementation
- Exact notification mechanisms
- Bank API integrations
- Automatic transaction matching
- Detailed committee permissions
- Detailed IT-manager permissions
- Detailed audit trails
- Exact report formats

These should be discussed and decided during development as the actual requirements become clearer.

Do not invent these details merely because a technically convenient implementation would require them.

---

# 35. Development Guidance for Future Agents

When starting a new conversation about this project, the agent should first understand the product at the conceptual level before proposing implementation changes.

Before making a decision, ask:

1. Does this make it easier for an owner to understand their obligations and financial position?
2. Does this preserve the representative's role as the main manager of building records?
3. Does this preserve separation between different buildings and apartments?
4. Does this unnecessarily assume that all buildings work the same way?
5. Does this unnecessarily limit future support for multiple owners, multiple apartments, multiple buildings, or additional roles?
6. Does this preserve the distinction between apartment-specific information and building-level information?
7. Does this keep the primary owner experience simple?
8. Does this work with both Hungarian and English interfaces?

### Mandatory Operating Rules (Alapszabályok):
- **Rule 1 (Bilingual Mandate)**: Mindent angolra is le kell fordítani (`translations.js` `hu` és `en`), hogy a lakók és képviselők bármikor válthassanak a nyelvek között.
- **Rule 2 (Documentation Mandate)**: Mindent dokumentálni kell a rendszerleírásokban (`/docs`), a dokumentációt kötelező bővíteni változás esetén és mankóként használni minden új feladatnál.
- **Rule 3 (Strict Database Mandate)**: A Firebase-ben vagy a honlapon tárolt adatokba belenyúlni szigorúan tilos felhasználói explicit utasítás nélkül.
- **Rule 4 (Security & Inviolability Mandate)**: Folyamatos törekvés az adatbiztonság és feltörhetetlenség fokozására; gyenge pontok esetén kötelező proaktív javaslattétel (lásd [docs/SECURITY_AND_DATA_PROTECTION.md](file:///c:/Users/bened/Documents/tarsasAPP/docs/SECURITY_AND_DATA_PROTECTION.md)).

If an implementation decision conflicts with these principles, the conflict should be identified rather than silently introducing a limitation.


---

# 36. Product North Star

The product can be summarized by the following principle:

> **When an owner opens the application, they should immediately know what they need to pay, how much they need to pay, and where to send it. When they want more information, they should be able to understand their apartment's financial history and access transparent information about the building, including its finances, loans, and documents. The representative manages the underlying records, while the platform remains flexible enough to support different buildings, ownership structures, financial arrangements, and roles.**

This principle should remain the central reference point for future product and technical decisions.

---

# 37. Status of This Document

This document represents the **current conceptual understanding of the project**.

It is intended to prevent future development conversations from starting from zero.

It should be updated when important product concepts change, but it should not be overloaded with temporary implementation details, current balances, individual transactions, or other data that changes during normal operation.

More detailed documentation should be created separately as the project develops, for example:

- Technical architecture documentation
- Database/data-model documentation
- UI/UX documentation
- Feature specifications
- Financial/business-rule documentation
- Permission matrix
- API documentation
- Deployment documentation

The context file should remain the stable high-level description of **what the product is and why it exists**.
