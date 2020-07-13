const path = require('path');
const { expect } = require('chai');
const { buildContractClass, bsv } = require('scrypttest');

/**
 * an example test for contract containing signature verification
 */
const { inputIndex, inputSatoshis, tx, signTx, toHex } = require('../testHelper');

const privateKey = new bsv.PrivateKey.fromRandom('testnet')
const publicKey = privateKey.publicKey
const pkh = bsv.crypto.Hash.sha256ripemd160(publicKey.toBuffer())
const privateKey2 = new bsv.PrivateKey.fromRandom('testnet')

describe('Test sCrypt contract DemoP2PKH In Javascript', () => {
  let demo
  let sig

  before(() => {
    //编译脚本，用于形成合约类
    const DemoP2PKH = buildContractClass(path.join(__dirname, '../../contracts/p2pkh.scrypt'), tx, inputIndex, inputSatoshis)
    console.log(DemoP2PKH)

    //从编译的脚本合约类，创建一个实例，传入一个hash160的公钥哈希
    console.log(toHex(pkh))
    demo = new DemoP2PKH(toHex(pkh))
    console.log(demo) 
    //log显示了构造出来的锁定脚本，已经填入公钥hash160哈希
    // 创建的脚本同标准脚本(OP_DUP OP_HASH160 <Public Key Hash> OP_EQUALVERIFY OP_CHECKSIG)并不一致, 这由编译器的算法决定,应该是等价的
    // 所有的脚本语言一览参见 https://wiki.bitcoinsv.io/index.php/Opcodes_used_in_Bitcoin_Script 
    // Contract {
    //   lockingScript: [
    //     'OP_1', //将数字1推入栈
    //     '40', //将0x40入栈???
    //     '00', //入栈. 
    //     '51', //入栈
    //     'b1', //入栈
    //     'b2', //入栈
    //     'OP_NOP', //Does nothing.
    //     'b4ef1a1d5fd9213127d129e65e077169a8f2359d', //入栈公钥哈希, 20个字节
    //     'OP_0', //An empty array of bytes is pushed onto the stack. (
    //     'OP_1', //1 入栈
    //     'OP_PICK', //复制1
    //     'OP_1', //1 入栈
    //     'OP_ROLL', //The item n back in the stack is moved to the top.
    //     'OP_DROP', //Removes the top stack item.
    //     'OP_NOP', //Does nothing.
    //     'OP_8',
    //     'OP_PICK',
    //     'OP_HASH160',
    //     'OP_1',
    //     'OP_PICK',
    //     'OP_EQUAL',
    //     'OP_VERIFY', 
    //     'OP_9', //10进制9入栈
    //     'OP_PICK', //The item 9 back in the stack is copied to the top.
    //     'OP_9', //10进制9入栈
    //     'OP_PICK', //The item 9 back in the stack is copied to the top.
    //     'OP_CHECKSIG', //The entire transaction's outputs, inputs, and script (from the most recently-executed OP_CODESEPARATOR to the end) are hashed. The signature used by OP_CHECKSIG must be a valid signature for this hash and public key. If it is, 1 is returned, 0 otherwise.
    //     'OP_NIP', //Removes the second-to-top stack item.
    //     'OP_NIP', //Removes the second-to-top stack item.
    //     'OP_NIP', //Removes the second-to-top stack item.
    //     'OP_NIP', //Removes the second-to-top stack item.
    //     'OP_NIP', //Removes the second-to-top stack item.
    //     'OP_NIP', //Removes the second-to-top stack item.
    //     'OP_NIP', //Removes the second-to-top stack item.
    //     'OP_NIP', //Removes the second-to-top stack item.
    //     'OP_NIP', //Removes the second-to-top stack item.
    //     'OP_NIP' //Removes the second-to-top stack item.
    //   ]
    // }
  });

  it('signature check should succeed when right private key signs', () => {
    //tx是在helper中创建的一个空的交易，填入锁定脚本，使用私钥签名，获取签名
    sig = signTx(tx, privateKey, demo.getLockingScript())
    //解锁脚本填入前一步的签名和公钥，测试解锁，返回应给为真
    console.log(toHex(sig), toHex(publicKey))
    expect(demo.unlock(toHex(sig), toHex(publicKey))).to.equal(true);
    /*
     * print out parameters used in debugger, see ""../.vscode/launch.json" for an example

    */
  //  console.log(toHex(pkh))
  //  console.log(toHex(sig))
  //  console.log(toHex(publicKey))
  //  console.log(tx.uncheckedSerialize())
    });

  it('signature check should fail when wrong private key signs', () => {
    //tx是在helper中创建的一个空的交易，填入锁定脚本，使用不同的私钥签名，获取签名
    sig = signTx(tx, privateKey2, demo.getLockingScript())
    //解锁脚本填入前一步的签名和公钥，测试解锁，返回应给为假，因为解锁用的公钥不匹配签名用的私钥
    expect(demo.unlock(toHex(sig), toHex(publicKey))).to.equal(false);
  });
});
