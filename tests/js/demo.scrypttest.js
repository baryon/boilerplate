// const console = require('tracer').colorConsole({
//   // inspectOpt: {
//   //   showHidden: true, //the object's non-enumerable properties will be shown too
//   //   depth: null //tells inspect how many times to recurse while formatting the object. This is useful for inspecting large complicated objects. Defaults to 2. To make it recurse indefinitely pass null.
//   // }
// })
const { expect } = require('chai');
const { buildContractClass } = require('scryptlib');
const { compileContract } = require('../../helper');

describe('Test sCrypt contract Demo In Javascript', () => {
  let demo, result

  before(() => {
    const Demo = buildContractClass(compileContract('demo.scrypt'));
    console.log('Demo',Demo)
    // add和sub是公开函数
    // abi: [
    //   { type: 'function', name: 'add', index: 0, params: [Array] },
    //   { type: 'function', name: 'sub', index: 1, params: [Array] },
    //   { type: 'constructor', name: 'constructor', params: [Array] }
    // ],
    //7和4作为两个数字，分别被压入栈中
    demo = new Demo(7, 4);
    console.log('demo',demo)
  });

  it('should return true', () => {
    //公开函数可以进行调用, addFn是一个函数调用，7+4的结果11是参数，进行函数调用
    const addFn = demo.add(7 + 4)
    console.log(addFn, addFn.unlockingScript.chunks)
    //解锁脚本传入的是两个数字，12和1，第一个参数估计是参数7+4的结果11。第2参数1估计表示第一个函数，也就是add
    result = addFn.verify()
    console.log(result)
    console.log(addFn.toScript())
    //result包含两个字段 success， true是成功，否则为false， error字段是出错原因，没出错则为空字符串
    expect(result.success, result.error).to.be.true
    const subFn = demo.sub(7 - 4)
    console.log(subFn, subFn.unlockingScript.chunks)
    //解锁脚本传入的是两个数字，3和2，第一个参数估计是参数7-4的结果3。第2参数3估计表示第一个函数，也就是sub
    result = subFn.verify()
    console.log(result)
    expect(result.success, result.error).to.be.true
  });

  it('should throw error', () => {
    const addFn = demo.add(0)
    console.log(addFn, addFn.unlockingScript.chunks)
     //解锁脚本传入的是两个数字，0和1，第一个参数估计是参数0。第2参数1估计表示第一个函数，也就是add
     result = addFn.verify()
    console.log(result)
    expect(result.success, result.error).to.be.false
    const subFn = demo.sub(1)
    console.log(subFn, subFn.unlockingScript.chunks)
    //解锁脚本传入的是两个数字，1和2，第一个参数估计是参数1。第2参数3估计表示第一个函数，也就是sub
    result = subFn.verify()
    console.log(result)
    expect(result.success, result.error).to.be.false
  });
});
