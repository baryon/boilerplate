const { bsv } = require( 'scryptlib')
const assert = require( 'assert' )

const specList = require('./spec')

const createBrfcId = function (spec) {
  const sha256d = bsv.crypto.Hash.sha256sha256
  const hash = sha256d(Buffer.from(
    spec.title.trim() +
    (spec.author || '').trim() +
    (spec.version || '').trim()
  ))
  const bitcoinDisplayHash = hash
    .reverse()
    .toString('hex')
  const brfcId = bitcoinDisplayHash.substring(0, 12)
  assert.strictEqual(brfcId, spec.brfc)
  return brfcId
}

const main = () => {
  specList.forEach(spec => {
    createBrfcId(spec)
  })
  console.log(JSON.stringify(specList))
}

main()
