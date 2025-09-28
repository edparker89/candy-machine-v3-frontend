import {
  CandyGuard,
  CandyMachine,
} from "@metaplex-foundation/mpl-candy-machine";
import { GuardReturn } from "../utils/checkerHelper";
import {
  AddressLookupTableInput,
  KeypairSigner,
  PublicKey,
  Transaction,
  Umi,
  createBigInt,
  generateSigner,
  publicKey,
  signAllTransactions,
} from "@metaplex-foundation/umi";
import {
  DigitalAsset,
  DigitalAssetWithToken,
  JsonMetadata,
  fetchDigitalAsset,
  fetchJsonMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { mintText } from "../settings";
import {
  Box,
  Button,
  Flex,
  HStack,
  Heading,
  SimpleGrid,
  Text,
  Tooltip,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  VStack,
  Divider,
  createStandaloneToast,
  Spinner,
} from "@chakra-ui/react";
import {
  fetchAddressLookupTable,
  setComputeUnitPrice,
} from "@metaplex-foundation/mpl-toolbox";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import {
  chooseGuardToUse,
  routeBuilder,
  mintArgsBuilder,
  GuardButtonList,
  buildTx,
  getRequiredCU,
} from "../utils/mintHelper";
import Timer from "./Timer";
import { useSolanaTime } from "@/utils/SolanaTimeContext";
import { verifyTx } from "@/utils/verifyTx";
import { base58 } from "@metaplex-foundation/umi/serializers";

const updateLoadingText = (
  loadingText: string | undefined,
  guardList: GuardReturn[],
  label: string,
  setGuardList: Dispatch<SetStateAction<GuardReturn[]>>
) => {
  const guardIndex = guardList.findIndex((g) => g.label === label);
  if (guardIndex === -1) {
    console.error("guard not found");
    return;
  }
  const newGuardList = [...guardList];
  newGuardList[guardIndex].loadingText = loadingText;
  setGuardList(newGuardList);
};

const fetchNft = async (umi: Umi, nftAdress: PublicKey) => {
  let digitalAsset: DigitalAsset | undefined;
  let jsonMetadata: JsonMetadata | undefined;
  try {
    digitalAsset = await fetchDigitalAsset(umi, nftAdress);
    jsonMetadata = await fetchJsonMetadata(umi, digitalAsset.metadata.uri);
  } catch (e) {
    console.error(e);
    createStandaloneToast().toast({
      title: "Nft could not be fetched!",
      description: "Please check your Wallet instead.",
      status: "info",
      duration: 900,
      isClosable: true,
    });
  }

  return { digitalAsset, jsonMetadata };
};

const mintClick = async (
  umi: Umi,
  guard: GuardReturn,
  candyMachine: CandyMachine,
  candyGuard: CandyGuard,
  ownedTokens: DigitalAssetWithToken[],
  mintAmount: number,
  mintsCreated:
    | {
        mint: PublicKey;
        offChainMetadata: JsonMetadata | undefined;
      }[]
    | undefined,
  setMintsCreated: Dispatch<
    SetStateAction<
      | { mint: PublicKey; offChainMetadata: JsonMetadata | undefined }[]
      | undefined
    >
  >,
  guardList: GuardReturn[],
  setGuardList: Dispatch<SetStateAction<GuardReturn[]>>,
  onOpen: () => void,
  setCheckEligibility: Dispatch<SetStateAction<boolean>>
) => {
  const guardToUse = chooseGuardToUse(guard, candyGuard);
  if (!guardToUse.guards) {
    console.error("no guard defined!");
    return;
  }

  try {
    const guardIndex = guardList.findIndex((g) => g.label === guardToUse.label);
    if (guardIndex === -1) {
      console.error("guard not found");
      return;
    }
    const newGuardList = [...guardList];
    newGuardList[guardIndex].minting = true;
    setGuardList(newGuardList);

    let routeBuild = await routeBuilder(umi, guardToUse, candyMachine);
    if (routeBuild && routeBuild.items.length > 0) {
      createStandaloneToast().toast({
        title: "Allowlist detected. Please sign to be approved to mint.",
        status: "info",
        duration: 900,
        isClosable: true,
      });
      routeBuild = routeBuild.prepend(
        setComputeUnitPrice(umi, {
          microLamports: parseInt(
            process.env.NEXT_PUBLIC_MICROLAMPORTS ?? "1001"
          ),
        })
      );
      const latestBlockhash = await umi.rpc.getLatestBlockhash({
        commitment: "finalized",
      });
      routeBuild = routeBuild.setBlockhash(latestBlockhash);
      const builtTx = await routeBuild.buildAndSign(umi);
      const sig = await umi.rpc
        .sendTransaction(builtTx, {
          skipPreflight: true,
          maxRetries: 1,
          preflightCommitment: "finalized",
          commitment: "finalized",
        })
        .then((signature) => {
          return { status: "fulfilled", value: signature };
        })
        .catch((error) => {
          createStandaloneToast().toast({
            title: "Allow List TX failed!",
            status: "error",
            duration: 900,
            isClosable: true,
          });
          return {
            status: "rejected",
            reason: error,
            value: new Uint8Array(),
          };
        });
      if (sig.status === "fulfilled")
        await verifyTx(umi, [sig.value], latestBlockhash, "finalized");
    }

    // fetch LUT
    let tables: AddressLookupTableInput[] = [];
    const lut = process.env.NEXT_PUBLIC_LUT;
    if (lut) {
      const lutPubKey = publicKey(lut);
      const fetchedLut = await fetchAddressLookupTable(umi, lutPubKey);
      tables = [fetchedLut];
    } else {
      createStandaloneToast().toast({
        title: "The developer should really set a lookup table!",
        status: "warning",
        duration: 900,
        isClosable: true,
      });
    }

    const mintTxs: Transaction[] = [];
    let nftsigners = [] as KeypairSigner[];

    const latestBlockhash = await umi.rpc.getLatestBlockhash({
      commitment: "finalized",
    });

    const mintArgs = mintArgsBuilder(candyMachine, guardToUse, ownedTokens);
    const nftMint = generateSigner(umi);
    const txForSimulation = buildTx(
      umi,
      candyMachine,
      candyGuard,
      nftMint,
      guardToUse,
      mintArgs,
      tables,
      latestBlockhash,
      1_400_000,
      false
    );
    const requiredCu = await getRequiredCU(umi, txForSimulation);

    for (let i = 0; i < mintAmount; i++) {
      const nftMint = generateSigner(umi);
      nftsigners.push(nftMint);
      const transaction = buildTx(
        umi,
        candyMachine,
        candyGuard,
        nftMint,
        guardToUse,
        mintArgs,
        tables,
        latestBlockhash,
        requiredCu,
        false
      );
      mintTxs.push(transaction);
    }
    if (!mintTxs.length) {
      console.error("no mint tx built!");
      return;
    }

    updateLoadingText(`Please sign`, guardList, guardToUse.label, setGuardList);
    const signedTransactions = await signAllTransactions(
      mintTxs.map((transaction, index) => ({
        transaction,
        signers: [umi.payer, nftsigners[index]],
      }))
    );

    let signatures: Uint8Array[] = [];

    const sendPromises = signedTransactions.map((tx, index) => {
      return umi.rpc
        .sendTransaction(tx, {
          skipPreflight: true,
          maxRetries: 1,
          preflightCommitment: "finalized",
          commitment: "finalized",
        })
        .then((signature) => {
          console.log(
            `Transaction ${index + 1} resolved with signature: ${
              base58.deserialize(signature)[0]
            }`
          );
          signatures.push(signature);
          return { status: "fulfilled", value: signature };
        })
        .catch((error) => {
          console.error(`Transaction ${index + 1} failed:`, error);
          return { status: "rejected", reason: error };
        });
    });

    await Promise.allSettled(sendPromises);

    updateLoadingText(
      `finalizing transaction(s)`,
      guardList,
      guardToUse.label,
      setGuardList
    );

    createStandaloneToast().toast({
      title: `${signedTransactions.length} Transaction(s) sent!`,
      status: "success",
      duration: 3000,
    });

    const successfulMints = await verifyTx(
      umi,
      signatures,
      latestBlockhash,
      "finalized"
    );

    updateLoadingText(
      "Fetching your NFT",
      guardList,
      guardToUse.label,
      setGuardList
    );

    const fetchNftPromises = successfulMints.map((mintResult) =>
      fetchNft(umi, mintResult).then((nftData) => ({
        mint: mintResult,
        nftData,
      }))
    );

    const fetchedNftsResults = await Promise.all(fetchNftPromises);

    let newMintsCreated: { mint: PublicKey; offChainMetadata: JsonMetadata }[] =
      [];
    fetchedNftsResults.map((acc) => {
      if (acc.nftData.digitalAsset && acc.nftData.jsonMetadata) {
        newMintsCreated.push({
          mint: acc.mint,
          offChainMetadata: acc.nftData.jsonMetadata,
        });
      }
      return acc;
    }, []);

    if (newMintsCreated.length > 0) {
      setMintsCreated(newMintsCreated);
      onOpen();
    }
  } catch (e) {
    console.error(`minting failed because of ${e}`);
    createStandaloneToast().toast({
      title: "Your mint failed!",
      description: "Please try again.",
      status: "error",
      duration: 900,
      isClosable: true,
    });
  } finally {
    const guardIndex = guardList.findIndex((g) => g.label === guardToUse.label);
    if (guardIndex === -1) {
      console.error("guard not found");
      return;
    }
    const newGuardList = [...guardList];
    newGuardList[guardIndex].minting = false;
    setGuardList(newGuardList);
    setCheckEligibility(true);
    updateLoadingText(undefined, guardList, guardToUse.label, setGuardList);
  }
};

type Props = {
  umi: Umi;
  guardList: GuardReturn[];
  candyMachine: CandyMachine | undefined;
  candyGuard: CandyGuard | undefined;
  ownedTokens: DigitalAssetWithToken[] | undefined;
  setGuardList: Dispatch<SetStateAction<GuardReturn[]>>;
  mintsCreated:
    | {
        mint: PublicKey;
        offChainMetadata: JsonMetadata | undefined;
      }[]
    | undefined;
  setMintsCreated: Dispatch<
    SetStateAction<
      | { mint: PublicKey; offChainMetadata: JsonMetadata | undefined }[]
      | undefined
    >
  >;
  onOpen: () => void;
  setCheckEligibility: Dispatch<SetStateAction<boolean>>;
};

export function ButtonList({
  umi,
  guardList,
  candyMachine,
  candyGuard,
  ownedTokens = [],
  setGuardList,
  mintsCreated,
  setMintsCreated,
  onOpen,
  setCheckEligibility,
}: Props): JSX.Element {
  const solanaTime = useSolanaTime();
  const [numberInputValues, setNumberInputValues] = useState<{
    [label: string]: number;
  }>({});
  if (!candyMachine || !candyGuard) {
    return <></>;
  }

  const handleNumberInputChange = (label: string, value: number) => {
    setNumberInputValues((prev) => ({ ...prev, [label]: value }));
  };

  let filteredGuardlist = guardList.filter(
    (elem, index, self) =>
      index === self.findIndex((t) => t.label === elem.label)
  );
  if (filteredGuardlist.length === 0) {
    return <></>;
  }
  if (filteredGuardlist.length > 1) {
    filteredGuardlist = guardList.filter((elem) => elem.label != "default");
  }
  let buttonGuardList = [];
  for (const guard of filteredGuardlist) {
    const text = mintText.find((elem) => elem.label === guard.label);
    const group = candyGuard.groups.find((elem) => elem.label === guard.label);
    let startTime = createBigInt(0);
    let endTime = createBigInt(0);
    if (group) {
      if (group.guards.startDate.__option === "Some") {
        startTime = group.guards.startDate.value.date;
      }
      if (group.guards.endDate.__option === "Some") {
        endTime = group.guards.endDate.value.date;
      }
    }

    let buttonElement: GuardButtonList = {
      label: guard ? guard.label : "default",
      allowed: guard.allowed,
      header: text ? text.header : "header missing in settings.tsx",
      mintText: text ? text.mintText : "mintText missing in settings.tsx",
      buttonLabel: text
        ? text.buttonLabel
        : "buttonLabel missing in settings.tsx",
      startTime,
      endTime,
      tooltip: guard.reason,
      maxAmount: guard.maxAmount,
    };
    buttonGuardList.push(buttonElement);
  }

  const listItems = buttonGuardList.map((buttonGuard, index) => (
    <Box key={index} marginTop={"20px"}>
      <Divider my="10px" />
      <HStack>
        <Heading
          size="md"
          textTransform="uppercase"
          fontFamily="'Creepster', cursive"
          color="black"
        >
          {buttonGuard.header}
        </Heading>
        <Flex justifyContent="flex-end" marginLeft="auto">
  {/* Countdown until start */}
  {buttonGuard.startTime > solanaTime && (
    <>
      <Text fontSize="sm" mr="2" fontFamily="'Jolly Lodger', cursive">
        Starts in:
      </Text>
      <Timer toTime={buttonGuard.startTime} solanaTime={solanaTime} />
    </>
  )}

  {/* Countdown until end */}
  {buttonGuard.endTime > solanaTime &&
    (!buttonGuard.startTime || buttonGuard.startTime - solanaTime <= 0n) && (
      <>
        <Text fontSize="sm" mr="2" fontFamily="'Jolly Lodger', cursive">
          Ending in:
        </Text>
        <Timer toTime={buttonGuard.endTime} solanaTime={solanaTime} />
      </>
    )}
</Flex>
      </HStack>
      <SimpleGrid columns={2} spacing={300}>
        <Text pt="2" fontSize="sm" fontFamily="'Jolly Lodger', cursive">
          {buttonGuard.mintText}
        </Text>
        <VStack>
          {process.env.NEXT_PUBLIC_MULTIMINT && buttonGuard.allowed ? (
            <NumberInput
              value={numberInputValues[buttonGuard.label] || 1}
              min={1}
              max={buttonGuard.maxAmount < 1 ? 1 : buttonGuard.maxAmount}
              size="sm"
              isDisabled={!buttonGuard.allowed}
              onChange={(valueAsString, valueAsNumber) =>
                handleNumberInputChange(buttonGuard.label, valueAsNumber)
              }
            >
              <NumberInputField fontFamily="'Jolly Lodger', cursive" />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          ) : null}

          <Tooltip label={buttonGuard.tooltip} aria-label="Mint button">
            <Button
              onClick={() =>
                mintClick(
                  umi,
                  buttonGuard,
                  candyMachine,
                  candyGuard,
                  ownedTokens,
                  numberInputValues[buttonGuard.label] || 1,
                  mintsCreated,
                  setMintsCreated,
                  guardList,
                  setGuardList,
                  onOpen,
                  setCheckEligibility
                )
              }
              key={buttonGuard.label}
              size="md"
              fontFamily="'Jolly Lodger', cursive"
              color="black"
              backgroundColor={buttonGuard.allowed ? "lightgray" : "darkgray"}
              _hover={{
                backgroundColor: buttonGuard.allowed ? "#7fbf6c" : "darkgray",
                color: "black",
              }}
              isDisabled={!buttonGuard.allowed}
              isLoading={
                guardList.find((elem) => elem.label === buttonGuard.label)
                  ?.minting
              }
              loadingText={
                guardList.find((elem) => elem.label === buttonGuard.label)
                  ?.loadingText
              }
              spinner={
                <Spinner
                  thickness="3px"
                  speed="0.65s"
                  emptyColor="gray.200"
                  color="#7fbf6c"
                  size="sm"
                />
              }
            >
              {buttonGuard.buttonLabel}
            </Button>
          </Tooltip>
        </VStack>
      </SimpleGrid>
    </Box>
  ));

  return <>{listItems}</>;
}
