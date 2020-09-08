const { expect } = require('chai');
const { bsv, buildContractClass, getPreimage, toHex, Sig, signTx, PubKey, num2bin, Bytes, Ripemd160 } = require('scryptlib');
const {
  inputIndex,
  inputSatoshis,
  tx,
  DataLen,
  compileContract
} = require('../../helper');

// make a copy since it will be mutated
const tx_ = bsv.Transaction.shallowCopy(tx)

// Test keys
const privateKey = new bsv.PrivateKey.fromRandom('testnet')
const publicKey = privateKey.publicKey
const pkh = bsv.crypto.Hash.sha256ripemd160(publicKey.toBuffer())

const Signature = bsv.crypto.Signature
// Note: ANYONECANPAY | SINGLE
//const sighashType = Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID
//const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID
const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_SINGLE | Signature.SIGHASH_FORKID
const outputAmount = 222222
const changeAmount = 111111

describe('Test improvedTokenUtxo contract In Javascript', () => {
  let counter, preimage, result
  let sig, newLockingScript, receiverHash

  const privateKey1 = new bsv.PrivateKey.fromRandom('testnet')
  const publicKey1 = bsv.PublicKey.fromPrivateKey(privateKey1)


  before(() => {
    const Token = buildContractClass(compileContract('improvedTokenUtxo.scrypt'))
    console.log(Token)
    token = new Token()
    console.log(token)

    // append state as passive data
    const ownerHash = publicKey.toAddress().hashBuffer.toString('hex')
    console.log(ownerHash)

    //初始化状态，设置100个Token的持有者
    token.dataLoad = ownerHash + num2bin(100, 8)
    console.log(token)

    //Token的接收者
    receiverHash = publicKey1.toAddress().hashBuffer.toString('hex')
    newLockingScript = token.codePart.toASM() + ' OP_RETURN ' + receiverHash + num2bin(100, 8)
    console.log(newLockingScript)

    // counter output
    tx_.addOutput(new bsv.Transaction.Output({
      script: bsv.Script.fromASM(newLockingScript),
      satoshis: 546
    }))

    // change output
    //tx_.change(privateKey.toAddress())
    // tx_.addOutput(new bsv.Transaction.Output({
    //   script: bsv.Script.buildPublicKeyHashOut(v),
    //   satoshis: changeAmount
    // }))
    console.log(token.lockingScript.toASM())

    preimage = getPreimage(tx_, token.lockingScript.toASM(), 546, 0, sighashType)
  });

  it('should succeed when transfering', () => {
    // any contract that includes checkSig() must be verified in a given context
    const context = { tx: tx_, inputIndex:0, inputSatoshis:546 }
    //tx是在helper中创建的一个空的交易，填入锁定脚本，使用私钥签名，获取签名
    sig = signTx(tx, privateKey, token.lockingScript.toASM(), 546, 0 )
    //transferFn = token.transfer(new Bytes(toHex(preimage)))

    console.log(bsv.Script.fromASM(newLockingScript).toHex())
    console.log(new Ripemd160(toHex(publicKey1)))
    transferFn = token.transfer(new Sig(toHex(sig)), new PubKey(toHex(publicKey)), new Bytes(receiverHash), new Bytes(toHex(preimage)) )
    console.log(transferFn)
    result = transferFn.verify(context)
    console.log(result)
    expect(result.success, result.error).to.be.true;
  });
});
