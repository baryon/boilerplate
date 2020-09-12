const { expect } = require('chai');
const { buildContractClass, getPreimage, toHex, Bytes } = require('scryptlib');

const { tx, compileContract, inputIndex, inputSatoshis } = require('../../helper');

describe('Test sCrypt contract Util In Javascript', () => {
    let util, preimage, result

    before(() => {
        const Util = buildContractClass(compileContract('util.scrypt'));
        console.log(Util)
        util = new Util();
        console.log(util)
        //tx是输入了UTXO的空交易，填入锁定脚本，和在锁定交易中的比特币数量，构建有一个输出的交易
        // getPreimage(tx, inputLockingScriptASM, inputAmount, inputIndex = 0, sighashType = exports.DEFAULT_SIGHASH_TYPE, flags = exports.DEFAULT_FLAGS) 
        // 获取原像函数，传入交易和锁定脚本，和这个输入satoshi数量， 签名类型是ALL+ForkId
        preimage = getPreimage(tx, util.lockingScript.toASM(), inputSatoshis)
        console.log(preimage)
    });

    it('should return true', () => {
        parser = util.testPreimageParsing(new Bytes(toHex(preimage)))
        console.log(parser)
        //校验的时候需要环境
        result = parser.verify({ tx, inputIndex, inputSatoshis })
        console.log(result)
        expect(result.success, result.error).to.be.true
    });
});