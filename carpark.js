const { MongoClient, ObjectID } = require('mongodb');
const { createServer } = require('http');
const { readFile } = require('fs');

// Connects to the configured mongoDB server, runs an operation, then disconnects.  Returns the results.
async function query( op ){
  if( !op )
    return undefined;

  // connect
  const client = new MongoClient( process.env.mongodb || 'mongodb://localhost:27017');
  const conn = await client.connect();

  // obtain the database and desired collection
  const db = client.db( process.env.db || 'carpark'),
        col = db.collection( process.env.collection || 'vehicles');

  // pass these to the operation, get output
  const results = await op( db, col ) || undefined;

  // cleanup and return
  client.close();
  return results;
}

// Register a new vehicle, by its licence plate.  This tracks when the vehicle entered the system.  Returns the Mongo
// ObjectID for the newly created record; this is used for handling outbound updates.
async function inbound( license, arrival = new Date() ){
  return query( async (, cars ) => {
    const record = await cars.insert({ license, arrival, departure: null });
    return record.insertedId;
  });
}

// Update the departure of a vehicle.  Returns the total time, in seconds, that it was parked in the garage.
async function outbound( id, departure = new Date() ){
  return query( async (, cars ) => {
    const record = await cars.findOneAndUpdate({ _id: new ObjectID( id ) }, { $set: { departure }});
    return ( departure.getTime() - record.arrival.getTime() ) * 1000;
  });
}

// Check for vehicle presence.  Returns the record(s) found, if any.
async function find( license, limit = 1 ){
  return query((, cars ) => cars.find({ license, departure: null }).limit( limit ).toArray() );
}

// Compute the charge for parking.
function computeCharge( seconds ){
  return ( seconds / 3600 ) * ( process.env.rate || 7.50 );
}

// Respond with a Not Allowed.
function notAllowed( res ){
  res.writeHead( 405, { 'Content-Type': 'application/json' });
  res.end({
    message: 'Method Not Allowed',
    expected: assert,
    received: req.method
  });
}

// Respond to API requests.
function respond( res, data ){
  res.writeHead( 200, { 'Content-Type': 'application/json' });
  res.end({ message: 'OK', data });
}

// should update this to use SSL/TLS, but don't have a means to create certs right now
const address = process.env.hostname || '0.0.0.0';
createServer( async( req, res ) => {

  // default web server logic -- get our static file target
  if( !/^\/api\/i.test( req.path )){
    const target = !/\.[^\/]+$/.test( req.path ) ? `${req.path}index.html` : req.path;
    return readFile( target, ( err, data ) => {
      if( err ){
        res.writeHead( 400, { 'Content-Type': 'text/plain' });
        return res.end('File Not Found');
      }

      // write it out
      res.writeHead( 200, { 'Content-Type': getMime( target ), 'Content-Length': data.length });
      return res.end( data );
    });
  }

  // API switch logic
  try {
    // read the body
    let body = '';
    req.on('data', d => body += d.toString() );

    // handle the desired operation
    req.on('end', () => {
      const vehicle = body.length >= 2 ? JSON.parse( body ) : {};

      // determine what to do
      const func = req.path.match( /\/api\/(.+?)\?/i )[1];
      switch( func ){

        // a new vehicle has arrived
        case 'inbound':
          if( req.method !== 'POST')
            return notAllowed( res );
          return respond( res, await inbound( vehicle.license, vehicle.arrival || new Date() ));

        // a vehicle has left, get the fee
        case 'outbound':
          if( req.method !== 'POST')
            return notAllowed( res );
          const time = await outbound( vehicle.recordID );
          return respond( res, { fee: computeCharge( time ) });

        // we need to determine the charge for how long they parked
        case 'fee':
          if( req.method !== 'GET')
            return notAllowed( res );
          return respond( res, computeCharge( vehicle.timeParked ));

        // we want to know if someone is still parked here
        case 'parked':
          if( req.method !== 'GET')
            return notAllowed( res );
          const hits = await find( vehicle.license );
          return respond( res, { parked: hits.length >= 1 });
      }
    });
  } catch( err ){
    console.error( err );

    // write out
    res.writeHead( 500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
}).listen( process.env.port || 8080, address );
