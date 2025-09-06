// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract CertifyChainV3 is Initializable, AccessControlUpgradeable {

    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    enum Status { Active, Revoked }

    struct Certificate {
        string certID;
        bytes32 fileHash;
        bytes32 ocrHash;
        bytes32 aiHash;
        bytes32 qrHash;
        uint8 anomalyScore;
        address issuer;
        uint256 timestamp;
        string[] corrections;
        Status status;
        string metadataURI; // optional JSON (OCR results, AI flags, etc.)
    }

    mapping(string => Certificate) private certificates;

    // Configurable verification threshold
    uint8 public verificationThreshold;

    // Events
    event CertificateAdded(string certID, address issuer);
    event CertificateCorrected(string certID, string correctionID);
    event CertificateVerified(string certID, address verifier, bool valid);
    event CertificateRevoked(string certID, address admin);
    event VerificationThresholdUpdated(uint8 newThreshold);

    // Initializer (for upgradeable contracts)
    function initialize(address admin) public initializer {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);

        verificationThreshold = 50; // default rule: anomalyScore < 50 = valid
    }

    // Add certificate
    function addCertificate(
        string memory certID,
        bytes32 fileHash,
        bytes32 ocrHash,
        bytes32 aiHash,
        bytes32 qrHash,
        uint8 anomalyScore,
        string memory metadataURI
    ) public onlyRole(ISSUER_ROLE) {
        require(certificates[certID].timestamp == 0, "Certificate exists");

        Certificate storage c = certificates[certID];
        c.certID = certID;
        c.fileHash = fileHash;
        c.ocrHash = ocrHash;
        c.aiHash = aiHash;
        c.qrHash = qrHash;
        c.anomalyScore = anomalyScore;
        c.issuer = msg.sender;
        c.timestamp = block.timestamp;
        c.status = Status.Active;
        c.metadataURI = metadataURI;
        emit CertificateAdded(certID, msg.sender);
    }

    // Correct certificate
    function correctCertificate(
        string memory certID,
        string memory correctionID,
        bytes32 newFileHash,
        bytes32 newOcrHash,
        bytes32 newAiHash,
        bytes32 newQrHash,
        uint8 newAnomalyScore,
        string memory newMetadataURI
    ) public onlyRole(ISSUER_ROLE) {
        Certificate storage c = certificates[certID];
        require(c.timestamp != 0, "Certificate does not exist");
        require(c.status == Status.Active, "Certificate revoked");

        c.corrections.push(correctionID);
        c.fileHash = newFileHash;
        c.ocrHash = newOcrHash;
        c.aiHash = newAiHash;
        c.qrHash = newQrHash;
        c.anomalyScore = newAnomalyScore;
        c.metadataURI = newMetadataURI;

        emit CertificateCorrected(certID, correctionID);
    }

    // Verify certificate (by verifier)
    function verifyCertificate(string memory certID) public onlyRole(VERIFIER_ROLE) returns (bool) {
        Certificate storage c = certificates[certID];
        require(c.timestamp != 0, "Certificate does not exist");
        require(c.status == Status.Active, "Certificate revoked");

        bool valid = c.anomalyScore < verificationThreshold;
        emit CertificateVerified(certID, msg.sender, valid);
        return valid;
    }

    // Revoke certificate (by admin)
    function revokeCertificate(string memory certID) public onlyRole(DEFAULT_ADMIN_ROLE) {
        Certificate storage c = certificates[certID];
        require(c.timestamp != 0, "Certificate does not exist");
        c.status = Status.Revoked;

        emit CertificateRevoked(certID, msg.sender);
    }

    // Update verification threshold (by admin)
    function updateVerificationThreshold(uint8 newThreshold) public onlyRole(DEFAULT_ADMIN_ROLE) {
        verificationThreshold = newThreshold;
        emit VerificationThresholdUpdated(newThreshold);
    }

    // View certificate
    function viewCertificate(string memory certID) public view returns (
        bytes32 fileHash,
        bytes32 ocrHash,
        bytes32 aiHash,
        bytes32 qrHash,
        uint8 anomalyScore,
        address issuer,
        uint256 timestamp,
        string[] memory corrections,
        Status status,
        string memory metadataURI
    ) {
        Certificate storage c = certificates[certID];
        return (
            c.fileHash,
            c.ocrHash,
            c.aiHash,
            c.qrHash,
            c.anomalyScore,
            c.issuer,
            c.timestamp,
            c.corrections,
            c.status,
            c.metadataURI
        );
    }
}
