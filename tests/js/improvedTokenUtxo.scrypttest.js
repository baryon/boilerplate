const { assert } = require('chai');
const { bsv, buildContractClass, getPreimage, toHex, Sig, signTx, PubKey, num2bin, Bytes, Ripemd160 } = require('scryptlib');
const {
  inputIndex,
  inputSatoshis,
  tx,
  DataLen,
  compileContract,
  outputs2Hex,
  string2Hex,
  hex2String,
  dummyTxId, reversedDummyTxId
} = require('../../helper');

// make a copy since it will be mutated
// const tx_ = bsv.Transaction.shallowCopy(tx)

// Test keys
const issuerPrivKey = new bsv.PrivateKey.fromRandom('testnet')
const issuerPubKey = issuerPrivKey.publicKey
const issuerPKH = bsv.crypto.Hash.sha256ripemd160(issuerPubKey.toBuffer())

const Signature = bsv.crypto.Signature
// Note: ANYONECANPAY | SINGLE
//const sighashType = Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID
//const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID
// const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_SINGLE | Signature.SIGHASH_FORKID
// const outputAmount = 222222
// const changeAmount = 111

describe('Test improvedTokenUtxo contract In Javascript', () => {
  let Token, holderSatoshi
  let sig, newLockingScript, ownerHash, receiverHash

  let output0, output1, output2, changeOutput



  before(() => {
    //编译脚本创建合约
    Token = buildContractClass(compileContract('improvedTokenUtxo.scrypt'))
    //console.log(Token, Token.abiCoder)
    //创建一个Dummy Token
    const token = new Token(new PubKey(toHex(issuerPubKey)), 0, 0)
    //根据Dummy Token的脚本长度，计算holderSatoshi
    holderSatoshi = token.codePart.toHex().length/2*3
    console.log(token.codePart.toHex().length/2)
    console.log(holderSatoshi)
  });

  it('initiate with maxSupply = 0', () => {

    const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID
    //const sighashType = Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID

    //Token增发无限制
    const maxSupply = 1024
    const token = new Token(new PubKey(toHex(issuerPubKey)), maxSupply, holderSatoshi)
    //console.log(token)
    //设置初始化状态
    /// name(64bytes) + symbol(16bytes) + issuer(64bytes) + rule(1byte) + holderSatoshi(4bytes) + decimals(1byte) + initialSupply(8bytes)   = 158bytes
    const name = "Test Fungible Token"
    const symbol = "TFT"
    const issuer = "ChainBow Co. Ltd."
    const rule = 0
    const decimals = 0
    const initialSupply = 1024
    const dataLoad =  num2bin(decimals, 1) + num2bin(initialSupply, 8)//string2Hex(name, 64)// + string2Hex(symbol, 16) + string2Hex(issuer, 64) + num2bin(rule, 1) + num2bin(holderSatoshi, 4) + num2bin(decimals, 1) + num2bin(initialSupply, 8)
    
    token.dataLoad = dataLoad


    console.log(hex2String(string2Hex(name, 64)))
    console.log(string2Hex(symbol, 16).length)
    console.log(string2Hex(issuer, 64))
    console.log(num2bin(rule, 1))
    console.log(num2bin(holderSatoshi, 4))
    console.log(num2bin(decimals, 1))
    console.log(num2bin(initialSupply, 8))

    // console.log(dataLoad)

    //console.log(token.lockingScript.toHex())


    //创建一个带有P2PKH UTXO的输入空交易
    tx_ = new bsv.Transaction()

    tx_.addInput(new bsv.Transaction.Input({
      prevTxId: dummyTxId,
      outputIndex: 0,
      script: ''
    }), bsv.Script.fromASM(token.lockingScript.toASM()), holderSatoshi)

    tx_.addInput(new bsv.Transaction.Input({
      prevTxId: dummyTxId,
      outputIndex: 1,
      script: ''
    }), bsv.Script.buildPublicKeyHashOut(issuerPubKey), 10000)

    //构造preimage
    let preimage = getPreimage(tx_, token.lockingScript.toASM(), holderSatoshi, 0, sighashType)
    console.log(preimage.length)

    const prevOutpoint = preimage.slice(68,104).toString('hex')
    const contractId = preimage.slice(68,100).reverse().toString('hex')
    console.log(contractId, prevOutpoint)
    assert.equal(contractId, dummyTxId);

    // const contractId = dummyTxId 

    const ownerPrivKey = new bsv.PrivateKey.fromRandom('testnet')
    const ownerPubKey = bsv.PublicKey.fromPrivateKey(ownerPrivKey)
    const ownerPKH = bsv.crypto.Hash.sha256ripemd160(ownerPubKey.toBuffer())

    //创建 UTXO Token LockingScript
    // codePart + OP_RETURN + contractId(32bytes) + prevOutpoint(36bytes) + ownerPkh(20bytes) + tokenAmount(8bytes) = 96bytes
    const data = num2bin(2, 1) + num2bin(initialSupply, 8) // + contractId// + prevOutpoint + toHex(ownerPKH) + num2bin(initialSupply, 8)
    const tokenLockingScript = token.codePart.toASM() + ' OP_RETURN ' + data

    console.log(data)
    console.log(tokenLockingScript)

    tx_.addOutput(new bsv.Transaction.Output({
      script: bsv.Script.fromASM(tokenLockingScript),
      satoshis: holderSatoshi
    }))


    console.log(tx_)

    // 设置校验环境 set txContext for verification
    token.txContext = {
      tx: tx_,
      inputIndex:0,
      inputSatoshis: holderSatoshi
    }

    //交易准备完成，创建preimage
    preimage = getPreimage(tx_, token.lockingScript.toASM(), holderSatoshi, 0, sighashType)
    // console.log(preimage.slice(68,104).toString('hex'))

    //构造发行商签名
    const sig = signTx(tx_, issuerPrivKey, token.lockingScript.toASM(), holderSatoshi, 0, sighashType)

    const initiateFn = token.initiate(new Sig(toHex(sig)), new Ripemd160(toHex(ownerPKH)), new Ripemd160(toHex(issuerPKH)), 100000, new Bytes(toHex(preimage)))
    //console.log(initiateFn)
    const result = initiateFn.verify()
    console.log(result)

    assert.isTrue(result.success, result.error);


    //
    // tx_.addInput(new bsv.Transaction.Input({
    //   prevTxId: dummyTxId,
    //   outputIndex: 0,
    //   script: ''
    // }), bsv.Script.fromASM(token.lockingScript.toASM()), holderSatoshi)

    // const newLockingScript0 = lockingScriptCodePart + ' OP_RETURN ' + toHex(publicKey2) + num2bin(0, DataLen) + num2bin(balance0, DataLen)
    // tx_.addOutput(new bsv.Transaction.Output({
    //   script: bsv.Script.fromASM(newLockingScript0),
    //   satoshis: outputAmount
    // }))

    // if (balance1 > 0) {
    //   const newLockingScript1 = lockingScriptCodePart + ' OP_RETURN ' + toHex(publicKey3) + num2bin(0, DataLen) + num2bin(balance1, DataLen)
    //   tx_.addOutput(new bsv.Transaction.Output({
    //     script: bsv.Script.fromASM(newLockingScript1),
    //     satoshis: outputAmount
    //   }))
    // }

    // token.txContext = { tx: tx_, inputIndex, inputSatoshis }
    
    // const preimage = getPreimage(tx_, token.lockingScript.toASM(), inputSatoshis, inputIndex)
    // const sig = signTx(tx_, privKey, token.lockingScript.toASM(), inputSatoshis)
    // return token.split(
    //   new Sig(toHex(sig)),
    //   new PubKey(toHex(publicKey2)),
    //   balanceInput0,
    //   outputAmount,
    //   new PubKey(toHex(publicKey3)),
    //   balanceInput1,
    //   outputAmount,
    //   new Bytes(toHex(preimage))
    // )

    // // append state as passive data
    // ownerHash = publicKey.toAddress().hashBuffer.toString('hex')
    // console.log(ownerHash)

    // //初始化状态，设置100个Token的持有者
    // token.dataLoad = ownerHash + num2bin(100, 8)
    // console.log(token)

    // //Token的接收者
    // receiverHash = publicKey1.toAddress().hashBuffer.toString('hex')
    // newLockingScript0 = token.codePart.toASM() + ' OP_RETURN ' + receiverHash + num2bin(100, 8)
    // //第二个输入分割成两个输出，分别是40和60
    // newLockingScript1 = token.codePart.toASM() + ' OP_RETURN ' + receiverHash + num2bin(40, 8)
    // newLockingScript2 = token.codePart.toASM() + ' OP_RETURN ' + ownerHash + num2bin(60, 8)
    // console.log(newLockingScript)

    // // output0
    // output0 = new bsv.Transaction.Output({
    //   script: bsv.Script.fromASM(newLockingScript0),
    //   satoshis: 546
    // })
    // tx_.addOutput(output0)

    // // output1
    // output1 = new bsv.Transaction.Output({
    //   script: bsv.Script.fromASM(newLockingScript1),
    //   satoshis: 546
    // })
    // tx_.addOutput(output1)

    // // output2
    // output2 = new bsv.Transaction.Output({
    //   script: bsv.Script.fromASM(newLockingScript2),
    //   satoshis: 546
    // })
    // tx_.addOutput(output2)

    // // change output
    // changeOutput = new bsv.Transaction.Output({
    //   script: bsv.Script.buildPublicKeyHashOut(privateKey.toAddress()),
    //   satoshis: changeAmount
    // })
    // tx_.addOutput(changeOutput)

    // console.log(token.lockingScript.toASM())
  });
/*
  it('should succeed when transfering', () => {

    //SINGLE Flag
    const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_SINGLE | Signature.SIGHASH_FORKID
    preimage = getPreimage(tx_, token.lockingScript.toASM(), 546, 0, sighashType)

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

    //ALL Flag
    const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID
    preimage = getPreimage(tx_, token.lockingScript.toASM(), 546, 0, sighashType)

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


  it('should succeed when burning', () => {
    //SINGLE Flag
    const sighashType = Signature.SIGHASH_ANYONECANPAY | Signature.SIGHASH_SINGLE | Signature.SIGHASH_FORKID
    preimage = getPreimage(tx_, token.lockingScript.toASM(), 546, 0, sighashType)

    // any contract that includes checkSig() must be verified in a given context
    const context = { tx: tx_, inputIndex:0, inputSatoshis:546 }
    //tx是在helper中创建的一个空的交易，填入锁定脚本，使用私钥签名，获取签名
    sig = signTx(tx, privateKey, token.lockingScript.toASM(), 546, 0 )
    //transferFn = token.transfer(new Bytes(toHex(preimage)))

    console.log(bsv.Script.fromASM(newLockingScript0).toHex())
    console.log(new Ripemd160(toHex(publicKey1)))
    burnFn = token.burn(new Sig(toHex(sig)), new PubKey(toHex(publicKey)), new Sig(toHex(sig)), new PubKey(toHex(publicKey)), new Ripemd160(toHex(publicKey)), new Bytes(toHex(preimage)) )
    console.log(burnFn)
    result = burnFn.verify(context)
    console.log(result)
    expect(result.success, result.error).to.be.true;
  });
*/
});
