const axios = require( 'axios' );
const {
  bsv,
  buildContractClass,
  getPreimage,
  toHex,
  num2bin,
  Bytes,
  signTx,
  PubKey,
  Sig
} = require( 'scryptlib' );
const {
  createLockingTx,
  unlockP2PKHInput
} = require('../helper');

const API_PREFIX = 'https://api.whatsonchain.com/v1/bsv/test'

const {
  privateKey
} = require( '../privateKey' );

async function sendTx(tx) {
  return axios.post(`${API_PREFIX}/tx/raw`, {
    txhex: tx.serialize()
  }).then(res=>{
    return res.data
  }).catch(e=>{
    throw `${tx.hash} ${e.message}  ${e.response.data}`
  })
}

async function main () {
  const address = privateKey.toAddress()
  //获取UTXO
  // step 1: fetch utxos
  let {
    data: utxos
  } = await axios.get(`${API_PREFIX}/address/${address}/unspent`)

  utxos = utxos.map((utxo) => ({
    txId: utxo.tx_hash,
    outputIndex: utxo.tx_pos,
    satoshis: utxo.value,
    script: bsv.Script.buildPublicKeyHashOut(address).toHex(),
  }))

  console.log( utxos )

  const minFee = 546
  const amountInContract = 546

  const unlock = 'OP_3 OP_2 OP_ADD'
  const lockingScript = 'OP_5 OP_EQUAL'
  //构建第一个交易
  //从P2PKH创建一个非标输出
  const tx0 = new bsv.Transaction().from(utxos)
  //非标输出，0
  tx0.addOutput(new bsv.Transaction.Output({
    script: bsv.Script.fromASM(lockingScript),
    satoshis: 5000,
  }))

  //找零P2PKH输出1
  tx0.change(address).fee(minFee)
  //对交易签名
  tx0.sign(privateKey)
  console.log(tx0)

  // txHex = tx.serialize( )
  // console.log(tx0)

  const tx0id = tx0.hash
  console.log(tx0id)
  //await sendTx(tx0)

  //创建第二个交易，解锁第一个交易的0号输出
  const tx1 = new bsv.Transaction()//.from(utxo1)

  tx1.addInput(new bsv.Transaction.Input({
    prevTxId: tx0id,
    outputIndex: 0,
    script: ''
  }), bsv.Script.fromASM(unlock), 5000)

  console.log(tx1)

  // tx1.addOutput(new bsv.Transaction.Output({
  //   script: bsv.Script.fromASM(lockingScript),
  //   satoshis: 4000,
  // }))

  //找零P2PKH输出1
  tx1.change(address).fee(minFee)

  //通过第一个交易的1号输出，准备第二个交易的1号输入
  // const utxo1 = [
  //   {
  //     txId: tx0id,
  //     outputIndex: 1,
  //     satoshis: utxos[0].satoshis-amountInContract-minFee,
  //     script: bsv.Script.buildPublicKeyHashOut(address).toHex(),
  //   }
  // ]

  //签名类型 ALL
  const Signature = bsv.crypto.Signature
  // //const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID
  const sighashType = Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID

  // tx1.change(address).fee(minFee)

  unlockP2PKHInput(privateKey, tx1, 0, sighashType)
  tx1.inputs[0].setScript(bsv.Script.fromASM(unlock))

  // console.log(tx1, tx1.inputs, tx1.outputs)

  //txHex = tx1.serialize( )
  console.log(tx1)


  // const sig = new bsv.Transaction.Signature({
  //   publicKey: privateKey.publicKey,
  //   prevTxId: tx0id,
  //   outputIndex: 1,
  //   inputIndex:1,
  //   signature: bsv.Transaction.Sighash.sign(tx1, privateKey, sighashType,
  //     1,
  //     bsv.Script.buildPublicKeyHashOut(address).toHex(),
  //     utxos[0].satoshis-amountInContract-minFee),
  //   sigtype:sighashType,
  // });

  // tx1.inputs[0].setScript(bsv.Script.buildPublicKeyHashIn(
  //   sig.publicKey,
  //   sig.signature.toDER(),
  //   sig.sigtype,
  // ))

  const tx1id = tx1.hash
  console.log(tx1id)

  try{

    tx1.verify()
    console.log('sending')
    console.log(await sendTx(tx0))
    console.log(await sendTx(tx1))
  
  }catch(e) {
    console.log(e)
  }

}


main()