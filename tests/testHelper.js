const { bsv } = require('scrypttest');
const Signature = bsv.crypto.Signature
const Interpreter = bsv.Script.Interpreter

const axios = require('axios')
const API_PREFIX = 'https://api.whatsonchain.com/v1/bsv/test'

const inputIndex = 0
const inputSatoshis = 100000
const flags = Interpreter.SCRIPT_VERIFY_MINIMALDATA | Interpreter.SCRIPT_ENABLE_SIGHASH_FORKID | Interpreter.SCRIPT_ENABLE_MAGNETIC_OPCODES | Interpreter.SCRIPT_ENABLE_MONOLITH_OPCODES
const sighashType = Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID
const minFee = 546

const utxo = {
  txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
  outputIndex: 0,
  script: '',   // placeholder
  satoshis: inputSatoshis
}
const tx = new bsv.Transaction().from(utxo)

//获取原像，原像就是做hash之前的数据。对一个原像计算哈希值，然后再签名
getPreimage = (tx, lockingScript, inputIndex = 0, inputAmount = inputSatoshis, sighashType = Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID) => bsv.Transaction.sighash.sighashPreimage(tx, sighashType, inputIndex, bsv.Script.fromASM(lockingScript), new bsv.crypto.BN(inputAmount), flags)

//对一个交易填入信息再签名
const signTx = (tx, privateKey, lockingScript, inputIndex = 0, inputAmount = inputSatoshis, sighashType = Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID) => {
  const asmLocking = bsv.Script.fromASM(lockingScript)
  console.log(asmLocking, asmLocking.toHex())
  return bsv.Transaction.sighash.sign(tx, privateKey, sighashType, inputIndex, asmLocking, new bsv.crypto.BN(inputAmount), flags).toTxFormat()
}

const toHex = (x) => { 
  return x.toString('hex')
}

async function createLockingTx(address, amountInContract) {
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

  // step 2: build the tx
  const tx = new bsv.Transaction().from(utxos)
  tx.addOutput(new bsv.Transaction.Output({
    script: new bsv.Script(), // place holder
    satoshis: amountInContract,
  }))
  tx.change(address).fee(minFee)
  return tx
}

function createUnlockingTx(prevTxId, inputAmount, lockingScript, spendAmount, changeAddr, spendLockingScript) {
  const tx = new bsv.Transaction()

  tx.addInput(new bsv.Transaction.Input({
    prevTxId,
    outputIndex: inputIndex,
    script: new bsv.Script(), // placeholder
  }), bsv.Script.fromASM(lockingScript), inputAmount)

  tx.addOutput(new bsv.Transaction.Output({
    script: bsv.Script.fromASM(spendLockingScript || lockingScript),
    satoshis: spendAmount,
  })).change(changeAddr).fee(minFee)

  return tx
}

async function sendTx(tx) {
  const {
    data: txid
  } = await axios.post(`${API_PREFIX}/tx/raw`, {
    txhex: tx.serialize()
  })
  return txid
}

// FIXME
int2Hex = n => {
  let s = n.toString(16);
  // even hex digits
  return (s.length % 2) > 0 ? "0" + s : s;
}

module.exports = {
    inputIndex: inputIndex,
    inputSatoshis: inputSatoshis,
    tx: tx,
    signTx: signTx,
    getPreimage: getPreimage,
    toHex: toHex,
    int2Hex: int2Hex,
    createLockingTx,
    createUnlockingTx,
    sendTx
}