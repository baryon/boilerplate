const { bsv, bin2num, num2bin } = require( 'scryptlib' )
const WhatsOnChain = require( 'whatsonchain' )
const _ = require( 'lodash' )

async function createScriptFromTx ( network, prevTxid, outputIndex, unlockTxId, scriptName ) {

  const woc = new WhatsOnChain( network )

  //fetch transaction from prevTxid
  const prevTx = await woc.txHash( prevTxid )

  //analyse locking script from transaction's outputIndex
  const output = prevTx.vout[ outputIndex ]
  const asm = ( new bsv.Script( output.scriptPubKey.hex ) ).toASM()
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
  const unlockTx = await woc.txHash( unlockTxId )
  let params, unlockParams
  for ( const input of unlockTx.vin ) {
    if ( input.vout === outputIndex && input.txid === prevTxid ) {
      const unlockASM = ( new bsv.Script( input.scriptSig.hex ) ).toASM()
      const asms = _.map( unlockASM.split( ' ' ), ( item ) => {
        switch ( item ) {
          case '0':
            return '00'
          case '-1':
            return '81'
          default:
            return item
        }
      } )
      params = 'bytes p0'
      unlockParams = `"b'${asms[ 0 ]}'"`
      for ( let i = 1; i < asms.length; i++ ) {
        params += `, bytes p${i}`
        unlockParams += `, "b'${asms[ i ]}'"`
      }

    }
  }
  if ( !unlockParams ) {
    throw "Can't found unlock script"
  }

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


  return { contract, debugSetting }
}

module.exports = createScriptFromTx

//network: testnet/livenet
const network = 'livenet'

//prevTxid
//const prevTxid = '3bf81a80b3e75627ebac4b5e9ab638f8c9141579fadcb1340b28a81c20a17cfc'//'b6e38bd77d00ce007c139f0e71c9c9fbade801eaa2ffcb95fd27849df110e86a'
const prevTxid = 'b6e38bd77d00ce007c139f0e71c9c9fbade801eaa2ffcb95fd27849df110e86a'

//outputIndex
const outputIndex = 0

//unlocking tx
const unlockTxId = '20adad8bd4cc694cfed4ccadff911433601e55b0f8779e839bc6579cb8d234f9'
// const unlockTxId = 'fc5e29ae7aafeb774cc1f94c951381bff358af64e8ad33a8a932c2271c64f2a4'//'20adad8bd4cc694cfed4ccadff911433601e55b0f8779e839bc6579cb8d234f9'

//scriptName
const scriptName = 'MultiSignBug'

createScriptFromTx( network, prevTxid, outputIndex, unlockTxId, scriptName )
