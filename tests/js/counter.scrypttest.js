const { expect } = require('chai');
const { bsv, buildContractClass, getPreimage, toHex, num2bin, SigHashPreimage } = require('scryptlib');

const {
  inputIndex,
  inputSatoshis,
  tx,
  DataLen,
  compileContract
} = require('../../helper');

// make a copy since it will be mutated
const tx_ = bsv.Transaction.shallowCopy(tx)
const outputAmount = 222222

describe('Test sCrypt contract Counter In Javascript', () => {
  let counter, preimage, result

  before(() => {
    const Counter = buildContractClass(compileContract('counter.scrypt'))
    console.log(Counter)

    counter = new Counter()
    console.log(counter)
    //原始锁定脚本不包含后面的数据
    console.log(counter.lockingScript.toASM())

    // set initial OP_RETURN value
    counter.setDataPart(num2bin(0, DataLen))

    //构造新的输出脚本
    //在锁定脚本后面加上了 OP_RETURN 01
    // DataLen为1， 表示只添加1个字节的数字，在合约中也是只处理1个字节
    const newLockingScript = counter.codePart.toASM() + ' OP_RETURN ' + num2bin(1, DataLen)
    console.log(newLockingScript)

    //tx_是新的输出交易，它从原空交易模版复制而来，bsv.Transaction.shallowCopy(tx)
    //把新的锁定脚本加入
    tx_.addOutput(new bsv.Transaction.Output({
      script: bsv.Script.fromASM(newLockingScript),
      satoshis: outputAmount
    }))

    //第一个参数tx_是新的交易，包含了新的输出 OP_RETURN 01
    //第二个参数输入的锁定脚本，OP_RETURN 00
    preimage = getPreimage(tx_, counter.lockingScript.toASM(), inputSatoshis)

    // set txContext for verification
    counter.txContext = {
      tx: tx_,
      inputIndex,
      inputSatoshis
    }
  });

  it('should succeed when pushing right preimage & amount', () => {
    result = counter.increment(new SigHashPreimage(toHex(preimage)), outputAmount).verify()
    expect(result.success, result.error).to.be.true
  });

  it('should fail when pushing wrong preimage', () => {
    result = counter.increment(new SigHashPreimage(toHex(preimage) + '01'), outputAmount).verify()
    expect(result.success, result.error).to.be.false
  });

  it('should fail when pushing wrong amount', () => {
    result = counter.increment(new SigHashPreimage(toHex(preimage)), outputAmount - 1).verify()
    expect(result.success, result.error).to.be.false
  });
});