const axios = require( 'axios' );
const API_PREFIX = 'https://api.whatsonchain.com/v1/bsv/test'
const { assert } = require( 'chai' );
const NETWORK = 'testnet'

const {
  bsv,
  buildContractClass,
  getPreimage,
  toHex,
  num2bin,
  Bytes,
  signTx,
  PubKey,
  Sig,
  Ripemd160
} = require( 'scryptlib' );


const {
  DataLen,
  loadDesc,
  createLockingTx,
  reverseEndian,
  showError,
  string2Hex,
  hex2String,
  unlockP2PKHInput
} = require( '../helper' );
const {
  privateKey
} = require( '../privateKey' );




async function fetchUtxo ( address, minAmount ) {
  return axios.get( `${API_PREFIX}/address/${address}/unspent` )
    .then( res => {
      return res.data
    } )
}

async function sendTx ( txHex ) {
  return axios.post( `${API_PREFIX}/tx/raw`, {
    txhex: txHex
  } ).then( res => {
    return res.data
  } ).catch( e => {
    throw `${e.message}  ${e.response.data}`
  } )
}

function analyseGenersisTx ( txHex ) {
  const tranaction = new bsv.Transaction( txHex )
  console.log( tranaction )
  const genesisOutput = tranaction.outputs[ 0 ]
  const lockingScript = Buffer.from( genesisOutput.script.toHex(), 'hex' )
  const scriptLen = lockingScript.length
  const supplyStart = scriptLen - 8;
  const decimalsStart = supplyStart - 1;
  const ruleStart = decimalsStart - 1;
  const issuerStart = ruleStart - 64;
  const symbolStart = issuerStart - 16;
  const nameStart = symbolStart - 64;

  const initialSupply = lockingScript.slice( supplyStart ).readUInt32LE()
  const decimals = lockingScript.slice( decimalsStart, supplyStart ).reverse().readUInt8()
  const rule = lockingScript.slice( ruleStart, decimalsStart ).reverse().readUInt8()
  const issuer = lockingScript.slice( issuerStart, ruleStart ).toString( 'utf8' ).trim()
  const symbol = lockingScript.slice( symbolStart, issuerStart ).toString( 'utf8' ).trim()
  const name = lockingScript.slice( nameStart, symbolStart ).toString( 'utf8' ).trim()

  const dataLenStart = nameStart - 1
  const pushDataStart = dataLenStart - 1
  const returnStart = pushDataStart - 1

  //删除包括OP RETURN的在内的数据，留下的核心代码
  const codePart = lockingScript.slice( 0, returnStart ).toString( 'hex' )

  console.log( initialSupply )
  console.log( decimals )
  console.log( rule )
  console.log( issuer )
  console.log( symbol )
  console.log( name )

  return {
    initialSupply,
    decimals,
    rule,
    issuer,
    symbol,
    name,
    codePart
  }

}

async function genesisAndInitiate ( issuerPrivKey, ownerPKH, maxSupply, witnessPKH, data ) {

  //发行商的公钥
  const issuerPubKey = issuerPrivKey.publicKey
  const issuerPKH = bsv.crypto.Hash.sha256ripemd160( issuerPubKey.toBuffer() )

  //签名类型 ALL
  const Signature = bsv.crypto.Signature
  const sighashType = Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID

  //获取合约代码
  const Token = buildContractClass( loadDesc( 'improvedTokenUtxo_desc.json' ) )


  //发行商公钥，最大公给量，见证人
  const token = new Token( new PubKey( toHex( issuerPubKey ) ), maxSupply, new Ripemd160( toHex( witnessPKH ) ) )
  
  //设置初始化状态
  // name(64bytes) + symbol(16bytes) + issuer(64bytes) + rule(1byte) + decimals(1byte) + initialSupply(8bytes)   = 158bytes
  const dataLoad = string2Hex( data.name, 64 ) + string2Hex( data.symbol, 16 ) + string2Hex( data.issuer, 64 ) + num2bin( data.rule, 1 ) + num2bin( data.decimals, 1 ) + num2bin( data.initialSupply, 8 )

  //设置Token的初始状态
  //下面这句相当于token.codePart.toASM() + ' OP_RETURN ' + dataLoad
  //而dataLoad是ASM格式写的，现在数据多余75个字节，那么在字节上前面会多出来 PUSHDATA1（1字节） + dataLen（1字节）。
  //如果数据长度少与75，那么就多出来一个字节，dataLen（1字节）（1-75）
  //如果长度超过65535, 那就会多出来3个字节 PUSHDATA1（1字节） + dataLen（2字节）。
  //多出来的字节在合约内部处理preimage的时候要格外注意
  token.dataLoad = dataLoad

  //核心代码，后面没有OP_RETURN
  const coreLockingScript = token.codePart.toASM()

  //前交易锁定代码，带有OP_RETURN以及后面的数据
  //完全的HEX拼接
  const lockingBodyScript = coreLockingScript + ' OP_RETURN'

  const lockingScript = token.lockingScript.toASM()

  //每个UTXO的持有费用
  const holderSatoshi = 546//Math.floor( ( 148 + token.lockingScript.toHex().length / 2 ) * 0.1 )


  const issuerAddress = issuerPubKey.toAddress()
  //获取发行商的UTXO

  //最少需要的UTXO价值，低于此数字无法发行
  //TODO: 需要更精确的数字，通过minReplyFee计算出来，要考虑整体交易的大小
  const minAmount = 300000;

  //TODO:需要考虑发行商多个地址的情况
  let utxos = await fetchUtxo( issuerAddress, minAmount )
  utxos = utxos.map( ( utxo ) => ( {
    txId: utxo.tx_hash,
    outputIndex: utxo.tx_pos,
    satoshis: utxo.value,
    script: bsv.Script.buildPublicKeyHashOut( issuerAddress ).toHex(),
  } ) )

  console.log( utxos )

  //构建第一个交易

  //从P2PKH创建一个非标输出
  const tx0 = new bsv.Transaction().from( utxos )
  //非标输出，0
  tx0.addOutput( new bsv.Transaction.Output( {
    script: bsv.Script.fromASM( lockingScript ),
    satoshis: holderSatoshi,
  } ) )

  //找零P2PKH输出1
  tx0.change( issuerAddress )

  //对交易签名
  tx0.sign( privateKey )

  const tx0id = tx0.hash

  //分析一个创世交易
  // const tx0hex = tx0.serialize()
  // const { codePart } = analyseGenersisTx( tx0hex )
  // //assert.equal(codePart, lockingBodyHex, 'invalid codeparts');

  //创建第二个交易，解锁第一个交易的0号输出
  const tx1 = new bsv.Transaction()//.from(utxos)


  const prevLockingScript = lockingScript

  //创世交易
  tx1.addInput( new bsv.Transaction.Input( {
    prevTxId: tx0id,
    outputIndex: 0,
    script: ''
  } ), bsv.Script.fromASM( prevLockingScript ), holderSatoshi )

  //创世交易的找零UTXO
  tx1.addInput( new bsv.Transaction.Input( {
    prevTxId: tx0id,
    outputIndex: 1,
    script: ''
  } ), bsv.Script.buildPublicKeyHashOut( issuerAddress ), tx0.outputs[ 1 ].satoshis )


  //构造前交易的outpoint, 反转txid+index
  var writer = new bsv.encoding.BufferWriter()
  //  outpoint (32-byte hash + 4-byte little endian)
  writer.writeReverse( Buffer.from( tx0id, 'hex' ) )
  writer.writeUInt32LE( 0 )
  const prevOutpoint = writer.toBuffer().toString( 'hex' )
  const contractId = tx0id

  //非标输出，0
  //创建 UTXO Token LockingScript
  // codePart + OP_RETURN + contractId(32bytes) + prevOutpoint(36bytes) + ownerPkh(20bytes) + tokenAmount(8bytes) = 96bytes
  const tokenData = contractId + prevOutpoint + toHex( ownerPKH ) + num2bin( data.initialSupply, 8 )
  const tokenLockingScript = lockingBodyScript + ' ' + tokenData

  tx1.addOutput( new bsv.Transaction.Output( {
    script: bsv.Script.fromASM( tokenLockingScript ),
    satoshis: holderSatoshi,
  } ) )

  //非标输出，1
  // codePart + OP_RETURN + contractId(32bytes) + prevOutpoint(36bytes) + totalSupply(8bytes) = 76bytes
  const batonData = contractId + prevOutpoint + num2bin( data.initialSupply, 8 )
  const batonLockingScript = lockingBodyScript + ' ' + batonData

  tx1.addOutput( new bsv.Transaction.Output( {
    script: bsv.Script.fromASM( batonLockingScript ),
    satoshis: holderSatoshi,
  } ) )


  //添加通知, 通知用户
  const ownerAddress = bsv.Address.fromPublicKeyHash( ownerPKH, NETWORK ).toString()
  tx1.addOutput( new bsv.Transaction.Output( {
    script: bsv.Script.buildPublicKeyHashOut( ownerAddress ),
    satoshis: 546,
  } ) )

  //添加通知, 通知全网见证人
  const witnessAddress = bsv.Address.fromPublicKeyHash( witnessPKH, NETWORK ).toString()
  tx1.addOutput( new bsv.Transaction.Output( {
    script: bsv.Script.buildPublicKeyHashOut( witnessAddress ),
    satoshis: 546,
  } ) )


  //找零P2PKH输出1
  tx1.change( issuerAddress )

  const changeSatoshi = tx1.outputs[ tx1.outputs.length - 1 ].satoshis

  unlockP2PKHInput( issuerPrivKey, tx1, 1, sighashType )

  //构造preimage
  let preimage = getPreimage( tx1, prevLockingScript, holderSatoshi, 0, sighashType )
  //console.log( preimage.toString( 'hex' ) )

  //preimage中会计算前交易的outpoint，应该等于我们自己构造的。
  //assert.equal( prevOutpoint, preimage.slice( 68, 104 ).toString( 'hex' ) );

  //构造发行商签名，只有签名同创世交易的发行商公钥一致才可以首次发行
  const sig = signTx( tx1, issuerPrivKey, prevLockingScript, holderSatoshi, 0, sighashType )

  const initiateFn = token.initiate( new Sig( toHex( sig ) ), new Ripemd160( toHex( ownerPKH ) ), new Ripemd160( toHex( issuerPKH ) ), changeSatoshi, new Bytes( toHex( preimage ) ), holderSatoshi )

  const unlockingScript = initiateFn.toScript()
  //console.log( unlockingScript )

  //设置第一个输入的解锁脚本，调用锁定代码里的initiate函数
  tx1.inputs[ 0 ].setScript( unlockingScript )


  tx0.verify()
  tx1.verify()
  console.log( 'sending' )

  const genersisTxId = await sendTx( tx0.serialize() )
  const initialSupplyTxId = await sendTx( tx1.serialize() )

  return { genersisTxId, initialSupplyTxId }

}




async function main () {

  // private keys of buyers - on testnet in WIF
  const key1 = 'cUUk8fqcS8TxVt3dXDjP8pKwD6irUB5V2ebCF7UVJfW3i3kXiBjs'//'mxv7C9BaV1LGkmKNZBdDnut99z23xp6mMD'
  const key2 = 'cTBnbZst1xVysfmLvNWFKYP12Ri29osvZ7AuWPScatUcLy8kH7j1'//'muvRot22uEmcTLe3UudCz4nnnRi5tMF675'
  const key3 = 'cT9RMrxRDdZduB89BEowkTEXDF9QA612NRZiCQrZwQLeju8fv8E7'//myyZ5dBL9X7YBmnJLKDhxYteRwbcpqtUYu
  const key4 = 'cTvyRutPvYKtj39eEkRMAXBsHAY3CkdKjrHmYt3PtcNjrhb8qm1X'//mwicTqgWNoHcm2wKfj7aoWftjWmCqLnaa6
  const key5 = 'cPjPZNvnT4a2xzuYtQsqNNTtw47ERQ97SHLohmHuEoQd36t7Fn5q'//mjL6VF6VpGUHQ6jNhqnJtC6SjEHXTNP9p4
  if ( !key1 || !key2 || !key3 || !key4 || !key5 ) {
    console.log( 'You must provide private keys to purchase tokens' )
    genPrivKey()
  }



  const privateKeys = [ key1, key2, key3, key4, key5 ].map( k => new bsv.PrivateKey.fromWIF( k ) )
  const publicKeys = new Array( privateKeys.length )
  // PKHs for receiving change from each transaction (20 bytes - 40 hexadecimal characters)
  const pkhs = new Array( privateKeys.length )

  // generate public keys, and PKHs
  for ( k = 0; k < privateKeys.length; k++ ) {
    publicKeys[ k ] = bsv.PublicKey.fromPrivateKey( privateKeys[ k ] )
    pkhs[ k ] = bsv.crypto.Hash.sha256ripemd160( publicKeys[ k ].toBuffer() )
  }




  const issuerPrivKey = privateKey //发行商私钥
  const issuerPubKey = issuerPrivKey.publicKey
  const maxSupply = 1024 //最大供应量等于初始值，不能增发

  const issuerPKH = bsv.crypto.Hash.sha256ripemd160( issuerPubKey.toBuffer() )
  const witnessPKH = issuerPKH //见证人公钥哈希

  const ownerAddress = publicKeys[ 0 ].toAddress()
  const ownerPKH = pkhs[ 0 ]


  const data = {
    name: "Test Fungible Token",
    symbol: "TFT",
    issuer: "ChainBow Co. Ltd.",
    rule: 1,
    decimals: 8,
    initialSupply: 1024
  }

  try {
    const { genersisTxId, initialSupplyTxId } = await genesisAndInitiate( issuerPrivKey, ownerPKH, maxSupply, witnessPKH, data )

    console.log( genersisTxId, initialSupplyTxId )

  } catch ( e ) {
    console.log( e )
  }

}

main()