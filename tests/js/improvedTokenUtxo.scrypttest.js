const { expect } = require('chai');
const { bsv, buildContractClass, getPreimage, toHex, Sig, signTx, PubKey, num2bin, Bytes, Ripemd160 } = require('scryptlib');
const {
  inputIndex,
  inputSatoshis,
  tx,
  DataLen,
  compileContract,
  outputs2Hex
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
const changeAmount = 111

describe('Test improvedTokenUtxo contract In Javascript', () => {
  let token, preimage, result
  let sig, newLockingScript, ownerHash, receiverHash

  let output0, output1, output2, changeOutput

  const privateKey1 = new bsv.PrivateKey.fromRandom('testnet')
  const publicKey1 = bsv.PublicKey.fromPrivateKey(privateKey1)


  before(() => {
    const Token = buildContractClass(compileContract('improvedTokenUtxo.scrypt'))
    console.log(Token)
    token = new Token()
    console.log(token)

    // append state as passive data
    ownerHash = publicKey.toAddress().hashBuffer.toString('hex')
    console.log(ownerHash)

    //初始化状态，设置100个Token的持有者
    token.dataLoad = ownerHash + num2bin(100, 8)
    console.log(token)

    //Token的接收者
    receiverHash = publicKey1.toAddress().hashBuffer.toString('hex')
    newLockingScript0 = token.codePart.toASM() + ' OP_RETURN ' + receiverHash + num2bin(100, 8)
    //第二个输入分割成两个输出，分别是40和60
    newLockingScript1 = token.codePart.toASM() + ' OP_RETURN ' + receiverHash + num2bin(40, 8)
    newLockingScript2 = token.codePart.toASM() + ' OP_RETURN ' + ownerHash + num2bin(60, 8)
    console.log(newLockingScript)

    // output0
    output0 = new bsv.Transaction.Output({
      script: bsv.Script.fromASM(newLockingScript0),
      satoshis: 546
    })
    tx_.addOutput(output0)

    // output1
    output1 = new bsv.Transaction.Output({
      script: bsv.Script.fromASM(newLockingScript1),
      satoshis: 546
    })
    tx_.addOutput(output1)

    // output2
    output2 = new bsv.Transaction.Output({
      script: bsv.Script.fromASM(newLockingScript2),
      satoshis: 546
    })
    tx_.addOutput(output2)

    // change output
    changeOutput = new bsv.Transaction.Output({
      script: bsv.Script.buildPublicKeyHashOut(privateKey.toAddress()),
      satoshis: changeAmount
    })
    tx_.addOutput(changeOutput)

    console.log(token.lockingScript.toASM())

    preimage = getPreimage(tx_, token.lockingScript.toASM(), 546, 0, sighashType)
  });

  it('should succeed when transfering', () => {
    // any contract that includes checkSig() must be verified in a given context
    const context = { tx: tx_, inputIndex:0, inputSatoshis:546 }
    //tx是在helper中创建的一个空的交易，填入锁定脚本，使用私钥签名，获取签名
    sig = signTx(tx, privateKey, token.lockingScript.toASM(), 546, 0 )
    //transferFn = token.transfer(new Bytes(toHex(preimage)))

    console.log(bsv.Script.fromASM(newLockingScript0).toHex())
    console.log(new Ripemd160(toHex(publicKey1)))
    transferFn = token.transfer(new Sig(toHex(sig)), new PubKey(toHex(publicKey)), new Bytes(receiverHash), new Bytes(toHex(preimage)) )
    console.log(transferFn)
    result = transferFn.verify(context)
    console.log(result)
    expect(result.success, result.error).to.be.true;
  });



  it('should succeed when splitting', () => {
    // any contract that includes checkSig() must be verified in a given context
    //第二个输入，分割 0 -》 1 如何创建第二个输入？？？
    const context = { tx: tx_, inputIndex:0, inputSatoshis:546 }
    //tx是在helper中创建的一个空的交易，填入锁定脚本，使用私钥签名，获取签名
    sig = signTx(tx, privateKey, token.lockingScript.toASM(), 546, 0 )

    console.log(bsv.Script.fromASM(newLockingScript1).toHex())
    console.log(new Ripemd160(toHex(publicKey1)))
    //从owner的100之中，发送40给receiver，找零60回到owner的地址
    //此交易没有前面的输出，没有后面的输出
    //构建前输出
    const prevOutput = output0
    //构建后输出
    const lastOutput = changeOutput

    console.log(outputs2Hex(prevOutput))
    console.log(outputs2Hex(lastOutput))

    splitFn = token.split(new Sig(toHex(sig)), new PubKey(toHex(publicKey)), new Bytes(receiverHash), 40, new Bytes(ownerHash), 60, new Bytes(outputs2Hex(prevOutput)), new Bytes(outputs2Hex(lastOutput)), new Bytes(toHex(preimage)) )
    console.log(splitFn)
    result = splitFn.verify(context)
    console.log(result)
    expect(result.success, result.error).to.be.true;
  });

});
