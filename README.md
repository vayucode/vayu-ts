# Vayu API Client Library ![client version](https://img.shields.io/npm/v/vayu-ts?label=Latest%20Version)

## Overview

The Vayu API client library in TypeScript allows you to submit events for processing and storage, manage billing-related entities, and perform various other operations seamlessly.

## Installation

Install the Vayu API client library using npm:

```bash
npm i vayu-ts
```

## Usage

### Initialization

Initialize the Vayu API client. 
> ⚠️ **The `CLIENT_ID` environment variable is required to use the Vayu API client.**

The `baseUrl` parameter is optional and defaults to Vayu's public API servers.

```typescript
import { Vayu } from 'vayu-ts';

const vayu = new Vayu(
  'your-access-token',
);
```

### Authentication

#### Login and authenticate

> **Note:** As of the latest version, calling `vayu.login()` is no longer required.
> Authentication is handled automatically on the first API call. The method still
> works for backward compatibility but can be safely removed.

```typescript
await vayu.login(); // Optional — authentication is now automatic
```

### Events

#### Sending Events

To send a batch of events for processing and storage:

```typescript
const events: Event[] = [
  {
    name: 'api_call',  // The distinctive label assigned to an event
    timestamp: new Date().toISOString(),  // The exact moment of event occurrence in ISO 8601 format
    customerAlias: 'customer_12345',  // A unique identifier assigned to each customer
    ref: '4f6cf35x-2c4y-483z-a0a9-158621f77a21',  // A universally unique identifier for each event
    data: {
      key1: 'processing_duration',  // Example additional data
      key2: 'api_url'  // Example additional data
    }
  }
];

const response = await vayu.events.send(events);

console.log(response.validEvents);
console.log(response.invalidEvents);
```

#### Querying Events

To fetch events occurring within a specified timestamp range:

```typescript
const response = await vayu.events.query({
  startTime: '2023-09-01T00:00:00.000Z',
  endTime: '2023-09-30T23:59:59.999Z',
  eventName: 'api_call',
  limit: 10
});

console.log(response.events);
```

#### Getting Event by Ref ID

To get a specific event using its reference ID:

```typescript
const response = await vayu.events.get('4f6cf35x-2c4y-483z-a0a9-158621f77a21');

console.log(response.event);
```

#### Deleting Event by Ref ID

To delete a specific event using its reference ID:

```typescript
const response = await vayu.events.delete('4f6cf35x-2c4y-483z-a0a9-158621f77a21');

console.log(response.event);
```

### Customers

#### Creating a Customer

To create a new customer:

```typescript
const response = await vayu.customers.create({
  name: 'John Doe',
  externalId: 'customer_12345'
});

console.log(response.customer);
```

#### Updating a Customer

To update an existing customer by ID:

```typescript
const response = await vayu.customers.update('customer-id', {
  name: 'Jane Doe',
  externalId: 'customer_67890'
});

console.log(response.customer);
```

#### Deleting a Customer

To delete a customer by ID:

```typescript
const response = await vayu.customers.delete('customer-id');

console.log(response.customer);
```

#### Getting Product Consumptions

To get product consumptions for a customer:

```typescript
const response = await vayu.customers.getProductConsumptions('customer-id');

console.log(response.productConsumptions);
```

### Contracts

#### Assigning a contract to a customer

In order to assign a contract to a customer you would need to provide the customer Id and the relevant plan

```typescript
	const response = await vayu.contracts.create({
    startDate: new Date(),
    endDate: undefined,
    customerId: '1f4cf23x-2c4y-483z-1111-158621f77a21',
    planId: '4f6cf35x-1234-483z-a0a9-158621f77a21',
  })

  console.log(response.contract)
```

### Meters

Meters are entities that track and aggregate usage data based on events. They are crucial for billing and monitoring purposes.

#### Listing Meters

To get a list of meters:

```typescript
const response = await vayu.meters.list({
  limit: 10,
  cursor: 'next-cursor'
});

console.log(response.meters);
console.log(response.total);
console.log(response.hasMore);
console.log(response.nextCursor);
```

### Webhooks

#### Subscribing to Events

You can subscribe to various events using webhooks. Here are the available subscription methods:

```typescript
// Subscribe to overage notifications
await vayu.webhooks.subscribeToOverage('https://your-webhook-url.com/overage');

// Subscribe to anonymous customer creation notifications
await vayu.webhooks.subscribeToAnonymousCustomerCreated('https://your-webhook-url.com/your_path');

// Validate webhook security
app.post('/webhooks', (req, res) => {
  const payload = JSON.stringify(req.body);
  const timestamp = Number(req.headers['x-timestamp']);
  const signature = String(req.headers['x-signature']);

  // Note: vayu.login() is no longer required — authentication is automatic.
  await vayu.login(); // Optional — kept for backward compatibility
  
  const isValid = vayu.verifyWebhookSignature({
    payload,
    timestamp,
    signature,
  });

  if (!isValid) {
    // Handle invalid token.
  }

  // Proceed with webhook handling
  console.log('Webhook is valid', JSON.parse(payload));
  
  // ... Handle event.
  
  res.sendStatus(200);
});

```

## Features

The Vayu API client library provides access to the following features:

- **Auth**
  - `auth.login()`
- **Events**
  - `events.send()`
  - `events.query()`
  - `events.get()`
  - `events.delete()`
  - `events.dryRun()`
- **Customers**
  - `customers.create()`
  - `customers.update()`
  - `customers.delete()`
  - `customers.list()`
  - `customers.get()`
  - `customers.getByExternalId()`
  - `customers.getProductConsumptions()`
- **Meters**
  - `meters.get()`
  - `meters.update()`
  - `meters.delete()`
  - `meters.list()`
- **Plans**
  - `plans.get()`
  - `plans.delete()`
  - `plans.list()`
- **Contracts**
  - `contracts.create()`
  - `contracts.delete()`
  - `contracts.list()`
  - `contracts.get()`
- **Invoices**
  - `invoices.get()`
  - `invoices.list()`
- **Webhooks**
  - `webhooks.subscribeToOverage()`
  - `webhooks.subscribeToAnonymousCustomerCreated()`
- **Product Consumption**
  - `productConsumption.get()`

## Support

If you have any questions or need further assistance, please contact Vayu at `team@withvayu.com`.

## License

This project is licensed under the MIT License.

---

This README provides an overview and usage examples for the Vayu API client library. For more detailed information on each method, please refer to the official Vayu API documentation.
