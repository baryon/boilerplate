const { expect } = require('chai');
const { bsv, buildContractClass, Ripemd160, Sig, PubKey, signTx, toHex } = require('scryptlib');

/**
 * an example test for contract containing signature verification
 */
const { compileContract, inputIndex, inputSatoshis, tx } = require('../../helper');

const privateKey = new bsv.PrivateKey.fromRandom('testnet')
const publicKey = privateKey.publicKey
const pkh = bsv.crypto.Hash.sha256ripemd160(publicKey.toBuffer())
const privateKey2 = new bsv.PrivateKey.fromRandom('testnet')

describe('Test sCrypt contract DemoP2PKH In Javascript', () => {
  let demo
  let sig

  before(() => {
    const DemoP2PKH = buildContractClass(compileContract('p2pkh.scrypt'))
    console.log('DemoP2PKH',DemoP2PKH)
    console.log('pkh',toHex(pkh))

    demo = new DemoP2PKH(new Ripemd160(toHex(pkh)))
    console.log('demo',demo) 
    console.log('lockingScript',demo.lockingScript) 

    //log显示了构造出来的锁定脚本
    // asm: 'OP_1 40 00 51 b1 b2 OP_NOP $pubKeyHash OP_0 OP_1 OP_PICK OP_1 OP_ROLL OP_DROP OP_NOP OP_8 OP_PICK OP_HASH160 OP_1 OP_PICK OP_EQUAL OP_VERIFY OP_9 OP_PICK OP_9 OP_PICK OP_CHECKSIG OP_NIP OP_NIP OP_NIP OP_NIP OP_NIP OP_NIP OP_NIP OP_NIP OP_NIP OP_NIP',
    // 同标准脚本(OP_DUP OP_HASH160 <Public Key Hash> OP_EQUALVERIFY OP_CHECKSIG)并不一致, 这由编译器的算法决定,应该是等价的
    // 所有的脚本语言一览参见 https://wiki.bitcoinsv.io/index.php/Opcodes_used_in_Bitcoin_Script 
    // Contract {
    //   lockingScript: [
    //     'OP_1', //将数字1推入栈 sig pk 1
    //     '40', //将0x40入栈 sig pk 1 40 
    //     '00', //入栈. sig pk 1 40 00
    //     '51', //入栈 sig pk 1 40 00 51
    //     'b1', //入栈 sig pk 1 40 00 51 b1
    //     'b2', //入栈 sig pk 1 40 00 51 b1 b2
    //     'OP_NOP', //什么也不做 sig pk 1 40 00 51 b1 b2
    //     'b4ef1a1d5fd9213127d129e65e077169a8f2359d', //入栈公钥哈希, 20个字节  sig pk 1 40 00 51 b1 b2 pkh 
    //     'OP_0', //空字节入栈 sig pk 1 40 00 51 b1 b2 pkh empty
    //     'OP_1', //1 入栈  sig pk 1 40 00 51 b1 b2 pkh empty 1
    //     'OP_PICK', //把堆栈的第1 个元素拷贝到栈顶，   sig pk 1 40 00 51 b1 b2 pkh empty pkh
    //     'OP_1', //1 入栈 sig pk 1 40 00 51 b1 b2 pkh empty pkh 1
    //     'OP_ROLL', //把堆栈的第1 个元素移动到栈顶 sig pk 1 40 00 51 b1 b2 pkh pkh empty
    //     'OP_DROP', //删除栈顶元素 sig pk 1 40 00 51 b1 b2 pkh pkh
    //     'OP_NOP', //无操作 sig pk 1 40 00 51 b1 b2 pkh pkh
    //     'OP_8',//数字8 入栈 sig pk 1 40 00 51 b1 b2 pkh pkh 8
    //     'OP_PICK',//把堆栈的第8 个元素拷贝到栈顶 sig pk 1 40 00 51 b1 b2 pkh pkh pk
    //     'OP_HASH160', // 对斩顶的pk计算哈希 sig pk 1 40 00 51 b1 b2 pkh pkh pkh2
    //     'OP_1', // 1 入栈 sig pk 1 40 00 51 b1 b2 pkh pkh pkh2 1
    //     'OP_PICK',//把堆栈的第1个元素拷贝到栈顶 sig pk 1 40 00 51 b1 b2 pkh pkh pkh2 pkh
    //     'OP_EQUAL', //栈顶的两个元素判断是否相等 sig pk 1 40 00 51 b1 b2 pkh pkh true
    //     'OP_VERIFY',  //检查栈顶元素是否为真 sig pk 1 40 00 51 b1 b2 pkh pkh true
    //     'OP_9', //10进制9入栈 sig pk 1 40 00 51 b1 b2 pkh pkh 9
    //     'OP_PICK', //把堆栈的第9个元素拷贝到栈顶 sig pk 1 40 00 51 b1 b2 pkh pkh sig
    //     'OP_9', //10进制9入栈 sig pk 1 40 00 51 b1 b2 pkh pkh sig 9
    //     'OP_PICK', //把堆栈的第9 个元素拷贝到栈顶 sig pk 1 40 00 51 b1 b2 pkh pkh sig pk
    //     'OP_CHECKSIG', //检查栈顶两个元素的签名 sig pk 1 40 00 51 b1 b2 pkh pkh true
    //     'OP_NIP', //删除栈顶的下一个元素 sig pk 1 40 00 51 b1 b2 pkh true
    //     'OP_NIP', //删除栈顶的下一个元素 sig pk 1 40 00 51 b1 b2 true
    //     'OP_NIP', //删除栈顶的下一个元素 sig pk 1 40 00 51 b1 true
    //     'OP_NIP', //删除栈顶的下一个元素 sig pk 1 40 00 51 true
    //     'OP_NIP', //删除栈顶的下一个元素 sig pk 1 40 00 true
    //     'OP_NIP', //删除栈顶的下一个元素 sig pk 1 40 true
    //     'OP_NIP', //删除栈顶的下一个元素 sig pk 1 true
    //     'OP_NIP', //删除栈顶的下一个元素 sig pk true
    //     'OP_NIP', //删除栈顶的下一个元素 sig true
    //     'OP_NIP' //删除栈顶的下一个元素  true
    //   ]
    // }
  });

  it('signature check should succeed when right private key signs', () => {
    //tx是在helper中创建的一个空的交易，填入锁定脚本，使用私钥签名，获取签名
    sig = signTx(tx, privateKey, demo.lockingScript.toASM(), inputSatoshis)
    //解锁脚本填入前一步的签名和公钥，测试解锁，返回应给为真
    result = demo.unlock(new Sig(toHex(sig)), new PubKey(toHex(publicKey))).verify( { tx, inputSatoshis, inputIndex } )
    expect(result.success, result.error).to.be.true

    //  * print out parameters used in debugger, see ""../.vscode/launch.json" for an example
    console.log('pkh',toHex(pkh))
    console.log('sig',toHex(sig))
    console.log('publicKey',toHex(publicKey))
    console.log('tx',tx.uncheckedSerialize())
  });

  it('signature check should fail when wrong private key signs', () => {
    //tx是在helper中创建的一个空的交易，填入锁定脚本，使用一个不同的私钥签名，获取签名
    sig = signTx(tx, privateKey2, demo.lockingScript.toASM(), inputSatoshis)
    //解锁脚本填入前一步的签名和公钥，测试解锁，返回应给为假，因为解锁用的公钥不匹配签名用的私钥
    result = demo.unlock(new Sig(toHex(sig)), new PubKey(toHex(publicKey))).verify( { tx, inputSatoshis, inputIndex } )
    expect(result.success, result.error).to.be.false
  });
});
