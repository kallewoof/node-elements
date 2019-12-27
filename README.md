# node-elements

Typescript/node bindings for Elements, using bcrpc.

Installation:
```Bash
$ node install --save node-elements
```

When making a request, you often need to either check the result, or use `.get()` on the command, which will throw an exception if an Elements or other error was encountered.

Example:
```JavaScript
// dict helper
const KV = (k, v) => {
    const kv = {};
    kv[k] = v;
    return kv;
};
// get a new confidential address from elements
const addr = GetNewAddress();
// fetch the addressinfo, and get the scriptPubKey from it
const spk = GetAddressInfo(addr).scriptPubKey;
// create a new raw transaction sending amount to the address
const crtres: string = elements.CreateRawTransaction([], KV(addr, amount)).get();
// fund it
const { hex, fee, changepos } = elements.FundRawTransaction(crtres).get();
// ...
```
