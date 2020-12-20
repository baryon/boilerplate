const bsv = require( 'bsv' )
const WhatsOnChain = require( 'whatsonchain' )
const _ = require( 'lodash' )

function bnToHex ( bn ) {
  var pos = true;
  bn = BigInt( bn );

  // I've noticed that for some operations BigInts can
  // only be compared to other BigInts (even small ones).
  // However, <, >, and == allow mix and match
  if ( bn < 0 ) {
    pos = false;
    bn = bitnot( bn );
  }

  var base = 16;
  var hex = bn.toString( base );
  if ( hex.length % 2 ) {
    hex = '0' + hex;
  }

  // Check the high byte _after_ proper hex padding
  var highbyte = parseInt( hex.slice( 0, 2 ), 16 );
  var highbit = ( 0x80 & highbyte );

  if ( pos && highbit ) {
    // A 32-byte positive integer _may_ be
    // represented in memory as 33 bytes if needed
    hex = '00' + hex;
  }

  return hex;
}

async function main ( network, prevTxid, outputIndex, unlockTxId, scriptName ) {
  const woc = new WhatsOnChain( network )

  //fetch transaction from prevTxid
  const prevTxHex = await woc.getRawTxData( prevTxid )

  //analyse locking script from transaction's outputIndex
  const prevTx = new bsv.Transaction( prevTxHex )
  const output = prevTx.outputs[ outputIndex ]
  const asm = output.script.toASM()
  const fixedAsm = _.map( asm.split( ' ' ), ( item ) => {
    switch ( item ) {
      case '0':
        return 'OP_0'
      case '-1':
        return 'OP_1NEGATE'
      default:
        return item
    }
  } ).join( ' ' )

  //fetch transaction from unlocking tx
  const unlockTxHex = await woc.getRawTxData( unlockTxId )
  const unlockTx = new bsv.Transaction( unlockTxHex )
  let params, unlockParams
  for ( const input of unlockTx.inputs ) {
    if ( input.outputIndex === outputIndex && input.prevTxId.toString( 'hex' ) === prevTxid ) {
      const unlockASM = input.script.toASM()
      const asms = unlockASM.split( ' ' )
      params = 'bytes p0'
      unlockParams = `"b'${bnToHex( BigInt( asms[ 0 ] ) )}'"`
      for ( let i = 1; i < asms.length; i++ ) {
        params += `, bytes p${i}`
        unlockParams += `, "b'${bnToHex( BigInt( asms[ 0 ] ) )}'"`
      }

    }
  }
  //const output = prevTx.outputs[ outputIndex ]

  //create scrypt file

  const contract = `
contract ${scriptName} {
  public function unlock(${params}) {
    asm {
      ${fixedAsm}
    }
  }
}
  `
  console.log( `${scriptName}.scrypt ` + '>'.repeat( 10 ) )
  console.log( contract )
  console.log( '<'.repeat( 10 ) + ` ${scriptName}.scrypt `, '\n' )


  const debugSetting = `
{
  "type": "scrypt",
  "request": "launch",
  "name": "Debug ${scriptName}",
  "program": "\${workspaceFolder}/contracts/${scriptName}.scrypt",
  "constructorParams": [
  ],
  "entryMethod": "unlock",
  "entryMethodParams": [
    ${unlockParams}
  ]
}
  `
  console.log( `launche.json ` + '>'.repeat( 10 ) )
  console.log( debugSetting )
  console.log( '<'.repeat( 10 ) + ` launche.json` )
}



//network: testnet/livenet
const network = 'livenet'

//prevTxid
const prevTxid = 'b6e38bd77d00ce007c139f0e71c9c9fbade801eaa2ffcb95fd27849df110e86a'

//outputIndex
const outputIndex = 0

//unlocking tx
const unlockTxId = '20adad8bd4cc694cfed4ccadff911433601e55b0f8779e839bc6579cb8d234f9'

//scriptName
const scriptName = 'MultiSignBug'


main( network, prevTxid, outputIndex, unlockTxId, scriptName )
