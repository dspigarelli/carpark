carpark
=======

This is an experimental API for managing a garage where vehicles pay a fee based on the amount of time they spend there.

### Conceptual Design

The overall design of the API is very simplistic, and is intended to be used on a small VPN or similar infrastructure wherein vehicles enter and exit through an automated tollbooth.  Upon entry, a driver should press a button to receive a ticket, used to identify their vehicle upon exit.

#### Arrival and Tickets

The entry tollbooth should have two cameras, which use optical character recognition (OCR) of some form to identify the license plate of the vehicle.  Once a driver has requested entry for their vehicle, their license plate is recorded at their arrival time -- when the button was pressed -- and a ticket is produced.

This ticket will bear a barcode, magnetic strip, or other medium upon which is recorded a unique identifier.  This ID, paired with the license plate of their vehicle, is used to validate their departure.

**POST example**

This is performed via the `inbound` API function.  The POST body should appear similarly:

```json
{
  "license": "ABC-1234",
  "arrival": "Thu, 10 Oct 2019 03:05:45 GMT"
}
```

The `arrival` time is not required; it will automatically be calculated.

**Response example**

The system will respond with the ticket's ID:

```json
{
  "message": "OK",
  "data": "a321244a51506716"
}
```

#### Departure and Validation

The exit tollbooth is designed identically to the entry booth.  Here, the driver should insert their ticket, which will log their departure and calculate the assessed fee for parking.  The identifier imprinted on the ticket is used along with the OCR pattern of their license plate to validate their departure.

It is up to the tollbooth or other point-of-sale endpoint to manage any monetary transactions.

**POST example**

This is performed via the `outbound` function.  The POST body should appear similarly:

```json
{
  "license": "ABC-1234",
  "recordID": "a321244a51506716"
}
```

An optional `departure` time may be specified as well.  If not provided, it will automatically be calculated.

**Response example**

The system will respond with the assessed fee and time parked, in seconds:

```json
{
  "message": "OK",
  "data": {
    "time": 477.71,
    "fee": 0.995
  }
}
```

#### Administrative tools

The following are administrative tools which are intended for the use of a manned station for handling issues.  All REST functions previously listed may be manually issued as well, allowing a terminal or other interface to be used.

##### PUT `fee`

The `fee` function will allows for fee estimation based upon time parked.

**Example request**

```json
{
  "timeParked": 19188
}
```

**Example response**

```json
{
  "message": "OK",
  "data": {
    "fee": 39.975
  }
}
```

##### PUT `parked`

The `parked` function will determine if a vehicle is parked in the garage and *has not* departed.  The request also allows an optional `recordID` value, if a ticket is present.

Returns either `true` or `false` for the data value.

**Example request**

```json
{
  "license": "ABC-1234"
}
```

**Example response**

```json
{
  "message": "OK",
  "data": true
}
```

##### GET `occupancy`

The `occupancy` function will list *all* vehicles which *have not* departed.  It takes no parameters.

The response returns an array of vehicle records.

# Setup

## Prerequisites:
- docker
- docker-compose

## Setup
- `docker-compose up -d mongo`
- `npm install`
- `npm start`

