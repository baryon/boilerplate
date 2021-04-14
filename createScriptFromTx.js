const bsv = require( 'bsv' )
const WhatsOnChain = require( 'whatsonchain' )
const _ = require( 'lodash' )


async function createScriptFromTx ( woc, prevTxid, outputIndex, scriptName, unlockParams = '', debugParams = '', txContext = {} ) {

  //fetch transaction from prevTxid
  const prevTxHex = await woc.getRawTxData( prevTxid )
  const prevTx = new bsv.Transaction(prevTxHex)

  //analyse locking script
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
  } ).join( '\n' )

  //create scrypt file
  const contract = `
contract ${scriptName} {
  public function unlock(${unlockParams}) {
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
  "constructorArgs": [
  ],
  "pubFunc": "unlock",
  "pubFuncArgs": [
    ${debugParams}
  ],
  "txContext": {
    "hex": "${txContext.hex}",
    "inputIndex": ${txContext.inputIndex},
    "inputSatoshis": ${prevTx.outputs[ outputIndex ].satoshis}
  }
}
  `
  console.log( `launche.json ` + '>'.repeat( 10 ) )
  console.log( debugSetting )
  console.log( '<'.repeat( 10 ) + ` launche.json` )


  return { contract, debugSetting }
}

async function createScriptFromUnlockTx ( woc, unlockTxId, inputIndex, scriptName ) {

  //fetch transaction from unlocking tx
  const unlockTxHex = await woc.getRawTxData( unlockTxId )
  const unlockTx = new bsv.Transaction(unlockTxHex)

  const input = unlockTx.inputs[ inputIndex ]

  const prevTxid = input.prevTxId.toString('hex')
  const outputIndex = input.outputIndex
  let unlockParams, debugParams
  const unlockASM = input.script.toASM()
  const asms = _.map( unlockASM.split( ' ' ), ( item ) => {
    switch ( item ) {
      case '0':
        return '00'
      case '-1', 'OP_1NEGATE':
        return '81'
      default:
        const m = item.match(/^OP_(\d+)$/)
        if(m) {
          const v = parseInt(m[1]).toString(16)
          return v.length < 2 ? '0' + v : v
        }
        return item
    }
  } )
  unlockParams = 'bytes p0'
  debugParams = `"b'${asms[ 0 ]}'"`
  for ( let i = 1; i < asms.length; i++ ) {
    unlockParams += `, bytes p${i}`
    debugParams += `, "b'${asms[ i ]}'"`
  }

  const txContext = {
    hex: unlockTx.uncheckedSerialize(),
    inputIndex
  }

  return createScriptFromTx(woc, prevTxid, outputIndex, scriptName, unlockParams, debugParams, txContext)
}


//network: testnet/livenet
const woc = new WhatsOnChain( 'livenet' )

//unlocking tx
//const unlockTxId = '20adad8bd4cc694cfed4ccadff911433601e55b0f8779e839bc6579cb8d234f9'
const unlockTxId = 'fc5e29ae7aafeb774cc1f94c951381bff358af64e8ad33a8a932c2271c64f2a4'
//const unlockTxId = '83a1d69d99797aee3936ced2908a59428e33db1fdaeee4125f278a3815b64403'

//Index
const inputIndex = 0

//scriptName
const scriptName = 'SimpleP2PKH'

createScriptFromUnlockTx( woc, unlockTxId, inputIndex, scriptName )
