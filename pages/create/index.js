import {
  Player,
  useUpdateAsset,
  useAsset,
  useCreateAsset,
} from "@livepeer/react";
import { useCallback, useEffect, useMemo, useState, useContext } from "react";
import { useDropzone } from "react-dropzone";
import { Types } from "aptos";
import { AddressContext } from "@/context/AddressProvider";
import { AptosContext } from "../_app";
import { parseArweaveTxId, parseCid } from "livepeer/media";
import { AptosClient } from "aptos";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

const NODE_URL = "https://fullnode.devnet.aptoslabs.com";

const Create = () => {
  const [video, setVideo] = useState();
  const [title, setTile] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [url, setUrl] = useState("");

  const {
    connect,
    account,
    network,
    connected,
    disconnect,
    wallet,
    wallets,
    signAndSubmitTransaction,
    signTransaction,
    signMessage,
    signMessageAndVerify,
  } = useWallet();

  const { address } = useContext(AddressContext);
  //const { aptosClient } = useContext(AptosContext);
  const aptosClient = new AptosClient(NODE_URL);

  const idParsed = useMemo(() => parseCid?.(url), [url]);

  //Create asset
  const {
    mutate: createAsset,
    data: asset,
    status,
    progress,
    error,
  } = useCreateAsset(
    video
      ? {
          sources: [
            {
              name: video.name,
              file: video,
              storage: {
                ipfs: true,
              },
            },
          ],
        }
      : null
  );

  //uploading on IPFS
  const assetId = asset?.[0].id;
  const {
    mutate: updateAsset,
    status: updateStatus,
    data: updatedData,
  } = useUpdateAsset({
    assetId,
    storage: {
      ipfs: true,
      metadata: {
        name: title,
        tag: tags,
        description: description,
      },
    },
  });

  useEffect(() => {
    console.log("title", title);
    console.log("tags", tags);
    console.log("description", description);
  }, [tags, description, tags]);
  useEffect(() => {
    console.log("updatedData", updatedData);
  }, [updatedData]);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles && acceptedFiles.length > 0 && acceptedFiles?.[0]) {
      setVideo(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      "video/*": ["*.mp4"],
    },
    maxFiles: 1,
    onDrop,
  });

  const progressFormatted = useMemo(
    () =>
      progress?.[0].phase === "failed"
        ? "Failed to process video."
        : progress?.[0].phase === "waiting"
        ? "Waiting"
        : progress?.[0].phase === "uploading"
        ? `Uploading: ${Math.round(progress?.[0]?.progress * 100)}%`
        : progress?.[0].phase === "processing"
        ? `Processing: ${Math.round(progress?.[0].progress * 100)}%`
        : null,
    [progress]
  );

  //Minting NFT
  const { data: NftAsset, status: assetStatus } = useAsset({
    assetId,
    enabled: assetId?.length === 36,
    refetchInterval: (asset) =>
      asset?.storage?.status?.phase !== "ready" ? 5000 : false,
  });

  const [isCreatingNft, setIsCreatingNft] = useState(false);

  const [creationHash, setCreationHash] = useState("");

  const mintNft = useCallback(async () => {
    setIsCreatingNft(true);
    console.log("functoin");
    try {
      console.log("In the try");
      console.log(address);
      console.log(updatedData?.storage?.ipfs?.nftMetadata?.url);
      console.log(aptosClient);
      if (address && aptosClient && updatedData?.storage?.ipfs?.nftMetadata?.url) {
        const body = {
          receiver: address,
          metadataUri: NftAsset.storage.ipfs.nftMetadata.url,
        };
        console.log("Running");
        const response = await fetch("/api/create-aptos-nft", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        console.log("response done");

        const json = await response.json();

        if (json.tokenName) {
          const createResponse = json;

          const transaction = {
            type: "entry_function_payload",
            function: "0x3::token_transfers::claim_script",
            arguments: [
              createResponse.creator,
              createResponse.creator,
              createResponse.collectionName,
              createResponse.tokenName,
              createResponse.tokenPropertyVersion,
            ],
            type_arguments: [],
          };

          const aptosResponse = await signAndSubmitTransaction(
            transaction
          );

          const result = await aptosClient.waitForTransactionWithResult(
            aptosResponse.hash,
            { checkSuccess: true }
          );

          setCreationHash(result.hash);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreatingNft(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    address,
    aptosClient,
    NftAsset?.storage?.ipfs?.nftMetadata?.url,
    setIsCreatingNft,
  ]);

  //Showing the videopreview
  useEffect(() => {
    console.log("address: ", address);
    console.log("aptosClient", aptosClient);
    console.log(" metadataURL", NftAsset?.storage?.ipfs?.nftMetadata?.url);
  }, [NftAsset]);

  return (
    <div className="  w-full px-10 -mt-4">
      <h2 className="  lg:text-3xl text-xl font-bold text-center">
        Post a video🚀
      </h2>
      <div className=" lg:mt-10 mt-5 ">
        <div className="  my-6">
          <label className=" lg:text-lg font-semibold " htmlFor="" />
          Title
          <input
            onChange={(e) => setTile(e.target.value)}
            type="text"
            className=" w-full border-2  border-slate-300 dark:border-slate-500  bg-transparent rounded-xl px-4 py-3 my-3 "
          />
        </div>
        <div className=" flex flex-col w-full my-6">
          <label className=" lg:text-lg font-semibold " htmlFor="">
            Tags
          </label>
          <input
            onChange={(e) => setTags(e.target.value)}
            type="text"
            className=" w-full border-2 border-slate-300 dark:border-slate-500 bg-transparent rounded-xl px-4 py-3 my-3 "
          />
        </div>
        <div className=" flex flex-col w-full my-6">
          <label
            className=" lg:text-lg font-semibold dark:"
            htmlFor=""
          >
            Description
          </label>
          <textarea
            onChange={(e) => setDescription(e.target.value)}
            type="text"
            rows="7"
            className=" w-full border-2 border-slate-300 dark:border-slate-500 bg-transparent rounded-xl px-4 py-3 my-3 "
          />
        </div>
        <div className=" flex justify-start items-center gap-10">
          <div className=" flex flex-col items-center justify-center  rounded-xl dark:bg-gray-800 bg-gray-300 w-[50%]  h-60">
            <div className="  text-center">
              <div className=" w-full" {...getRootProps()}>
                <input {...getInputProps()} />
                <p className=" text-3xl font-extrabold text-gray-600 my-3">
                  Drag and drop or browse files
                </p>
              </div>
              {video ? (
                <p> {video.name} </p>
              ) : (
                <p> Drag your video here </p>
              )}
              {progressFormatted && <p> {progressFormatted} </p>}
            </div>
          </div>

          <div className=" h-60 bg-black  ove w-[30%] rounded-xl">
            {updatedData && (
              <Player
                playbackId={updatedData?.storage?.ipfs?.cid}
                autoPlay
                muted
              />
            )}
          </div>
        </div>
      </div>

      {updateStatus === "success" ? (
        <div className=" mt-14 flex justify-center items-center">
          {creationHash && (
            <a
              href={`https://explorer.aptoslabs.com/txn/${creationHash}?network=Devnet`}
            >
              View Mint Transaction
            </a>
          )}
          <button
            onClick={() => mintNft?.()}
            className=" bg-blue-600 text-white  rounded-xl font-semibold text-[14px] lg:text-[20px] px-8 lg:px-20 py-2 "
          >
            Mint Video NFT
          </button>
        </div>
      ) : (
        <div className=" mt-14 flex justify-center items-center">
          {status === "success" ? (
            <button
              onClick={() => updateAsset?.()}
              className=" bg-blue-600 text-white rounded-xl font-semibold text-[14px] lg:text-[20px] px-8 lg:px-20 py-2 "
            >
              {updateStatus === "loading" ? "Loading...." : "Upload to IPFS"}
            </button>
          ) : (
            <button
              button
              disabled={status === "loading" || !video}
              onClick={() => createAsset?.()}
              className=" bg-blue-600 text-white rounded-xl font-semibold text-[14px] lg:text-[20px] px-8 lg:px-20 py-2 "
            >
              {status === "loading" ? "Loading..." : "Create"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Create;
