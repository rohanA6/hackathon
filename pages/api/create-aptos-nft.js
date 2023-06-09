import { AptosAccount, AptosClient, HexString, TokenClient } from 'aptos';
 
import { NextApiRequest, NextApiResponse } from 'next';
 
 
const NODE_URL = 'https://fullnode.devnet.aptoslabs.com';
 
const COLLECTION_NAME = 'Livepeer Video NFT';
const COLLECTION_DESCRIPTION =
  "Video NFTs using Livepeer's decentralized video transcoding protocol.";
const COLLECTION_URI = 'https://livepeer.org';
 
const TOKEN_VERSION = 0;
const TOKEN_DESCRIPTION =
  "A video NFT which uses Livepeer's decentralized video transcoding protocol.";
 
const handler = async (
  req,
  res,
) => {
  try {
    const method = req.method;
 
    if (method === 'POST') {
      const { receiver, metadataUri }= req.body;
 
      if (!receiver || !metadataUri) {
        return res.status(400).json({ message: 'Missing data in body.' });
      }
 
      const client = new AptosClient(NODE_URL);
      const tokenClient = new TokenClient(client);
 
      if (!process.env.APTOS_PRIVATE_KEY) {
        return res.status(500).json({ message: 'Aptos config missing.' });
      }
 
      const issuer = new AptosAccount(
        new HexString(process.env.APTOS_PRIVATE_KEY).toUint8Array(),
      );
 
      let collectionData;
 
      try {
        collectionData = await tokenClient.getCollectionData(
          issuer.address(),
          COLLECTION_NAME,
        );
      } catch (e) {
        // if the collection does not exist, we create it
        const createCollectionHash = await tokenClient.createCollection(
          issuer,
          COLLECTION_NAME,
          COLLECTION_DESCRIPTION,
          COLLECTION_URI,
        );
        await client.waitForTransaction(createCollectionHash, {
          checkSuccess: true,
        });
 
        collectionData = await tokenClient.getCollectionData(
          issuer.address(),
          COLLECTION_NAME,
        );
      }
 
      // each token increments by 1, e.g. "Video NFT 1"
      const tokenName = `Video NFT ${Number(collectionData?.supply ?? 0) + 1}`;
 
      const createTokenHash = await tokenClient.createToken(
        issuer,
        COLLECTION_NAME,
        tokenName,
        TOKEN_DESCRIPTION,
        1,
        metadataUri,
      );
      await client.waitForTransaction(createTokenHash, { checkSuccess: true });
 
      
      const offerTokenHash = await tokenClient.offerToken(
        issuer,
        receiver,
        issuer.address(),
        COLLECTION_NAME,
        tokenName,
        1,
        TOKEN_VERSION,
      );
      await client.waitForTransaction(offerTokenHash, { checkSuccess: true });
 
      return res.status(200).json({
        creator: issuer.address().hex(),
        collectionName: COLLECTION_NAME,
        tokenName,
        tokenPropertyVersion: TOKEN_VERSION,
      });
    }
 
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: (err)?.message ?? 'Error' });
  }
};
 
export default handler;