const { ethers, upgrades } = require("hardhat");

async function main() {
  console.log("🚀 Deploying CertifyChainV3 to zkSync...");

  // 1. Load contract
  const CertifyChainV3 = await ethers.getContractFactory("CertifyChainV3");

  // 2. Deploy upgradeable proxy
  const proxy = await upgrades.deployProxy(CertifyChainV3, [], {
    initializer: "initialize", // if you have an initialize() function
    kind: "uups",              // UUPS upgradeable
  });

  await proxy.waitForDeployment();

  console.log("✅ CertifyChainV3 Proxy deployed to:", await proxy.getAddress());
  console.log("🔗 Implementation address:", await upgrades.erc1967.getImplementationAddress(await proxy.getAddress()));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Deployment failed:", err);
    process.exit(1);
  });
