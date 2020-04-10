# node-elements

Typescript/node bindings for Elements, using bcrpc.

Installation:
```Bash
$ node install --save node-elements
```

For typescript, you also want `@types/node-elements`.

Example:
```JavaScript
// dict helper
const KV = (k, v) => {
    const kv = {};
    kv[k] = v;
    return kv;
};
// get a new confidential address from elements
const addr = await GetNewAddress();
// fetch the addressinfo, and get the scriptPubKey from it
const spk = (await GetAddressInfo(addr)).scriptPubKey;
// create a new raw transaction sending amount to the address
const crtres: string = await elements.CreateRawTransaction([], KV(addr, amount));
// fund it
const { hex, fee, changepos } = await elements.FundRawTransaction(crtres);
// ...
```
