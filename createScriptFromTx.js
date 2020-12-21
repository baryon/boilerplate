const bsv = require( 'bsv' )
const WhatsOnChain = require( 'whatsonchain' )
const _ = require( 'lodash' )

async function createScriptFromTx ( network, unlockTxId, inputIndex, scriptName ) {

  const woc = new WhatsOnChain( network )

  //fetch transaction from unlocking tx
  const unlockTx = await woc.txHash( unlockTxId )
  const input = unlockTx.vin[ inputIndex ]
  const prevTxid = input.txid
  const outputIndex = input.vout
  let params, unlockParams
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

  //fetch transaction from prevTxid
  const prevTx = await woc.txHash( prevTxid )

  //analyse locking script
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

//debug's setting, paste to .vscode/launch.json
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

//unlocking tx
const unlockTxId = '20adad8bd4cc694cfed4ccadff911433601e55b0f8779e839bc6579cb8d234f9'
//const unlockTxId = 'fc5e29ae7aafeb774cc1f94c951381bff358af64e8ad33a8a932c2271c64f2a4'

//outputIndex
const inputIndex = 0

//scriptName
const scriptName = 'MultiSignBug'

createScriptFromTx( network, unlockTxId, inputIndex, scriptName )
