import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { RoleManager } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TribeController } from "../../typechain-types";

describe("RoleManager", function () {
  let roleManager: RoleManager;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let tribeController: TribeController;

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();
    
    const RoleManager = await ethers.getContractFactory("RoleManager");
        roleManager = await upgrades.deployProxy(RoleManager, [], { kind: 'uups' });
    await roleManager.waitForDeployment();

    const TribeController = await ethers.getContractFactory("TribeController");
        tribeController = await upgrades.deployProxy(TribeController, [roleManager.target], { kind: 'uups' });
    await tribeController.waitForDeployment();
  });

  describe("Role Assignment", function () {
    it("Should assign roles correctly", async function () {
      // Assign different roles to users
      await roleManager.assignRole(user1.address, await roleManager.FAN_ROLE());
      await roleManager.assignRole(user2.address, await roleManager.ORGANIZER_ROLE());
      await roleManager.assignRole(user2.address, await roleManager.MODERATOR_ROLE());

      // Check individual roles
      expect(await roleManager.hasRole(await roleManager.FAN_ROLE(), user1.address)).to.be.true;
      expect(await roleManager.hasRole(await roleManager.ORGANIZER_ROLE(), user2.address)).to.be.true;
      expect(await roleManager.hasRole(await roleManager.MODERATOR_ROLE(), user2.address)).to.be.true;
    });

    it("Should remove roles correctly", async function () {
      // Assign and then remove roles
      await roleManager.assignRole(user1.address, await roleManager.FAN_ROLE());
      await roleManager.removeRole(user1.address, await roleManager.FAN_ROLE());

      expect(await roleManager.hasRole(await roleManager.FAN_ROLE(), user1.address)).to.be.false;
    });

    it("Should only allow admin to assign roles", async function () {
      const ADMIN_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ADMIN_ROLE"));
      
      // Regular user tries to assign a role
      await expect(
        roleManager.connect(user2).assignRole(user3.address, ADMIN_ROLE)
      ).to.be.reverted; // Use generic .reverted instead of specific error
    });
  });

  describe("Role Verification", function () {
    beforeEach(async function () {
      // Setup some roles for testing
      await roleManager.assignRole(user1.address, await roleManager.FAN_ROLE());
      await roleManager.assignRole(user2.address, await roleManager.ORGANIZER_ROLE());
      await roleManager.assignRole(user2.address, await roleManager.MODERATOR_ROLE());
    });

    it("Should check for any role correctly", async function () {
      const roles = [
        await roleManager.FAN_ROLE(),
        await roleManager.ORGANIZER_ROLE()
      ];

      expect(await roleManager.hasAnyRole(user1.address, roles)).to.be.true;
      expect(await roleManager.hasAnyRole(user2.address, roles)).to.be.true;
      expect(await roleManager.hasAnyRole(user3.address, roles)).to.be.false;
    });

    it("Should check for all roles correctly", async function () {
      const roles = [
        await roleManager.ORGANIZER_ROLE(),
        await roleManager.MODERATOR_ROLE()
      ];

      expect(await roleManager.hasAllRoles(user2.address, roles)).to.be.true;
      expect(await roleManager.hasAllRoles(user1.address, roles)).to.be.false;
    });

    it("Should get user roles correctly", async function () {
      const user2Roles = await roleManager.getUserRoles(user2.address);
      expect(user2Roles.length).to.equal(2);
      expect(user2Roles).to.include(await roleManager.ORGANIZER_ROLE());
      expect(user2Roles).to.include(await roleManager.MODERATOR_ROLE());
    });
  });

  describe("Special Fan Role Assignment", function () {
    it("Should allow admin to assign fan role", async function () {
      await roleManager.assignFanRole(user1.address);
      expect(await roleManager.hasRole(await roleManager.FAN_ROLE(), user1.address)).to.be.true;
    });

    it("Should not allow non-admin to assign fan role", async function () {
      await expect(
        roleManager.connect(user1).assignFanRole(user2.address)
      ).to.be.revertedWith("Caller is not authorized");
    });
  });

  describe("User Role Access", function () {
    it("Should allow user to access community features if they have the correct role", async function () {
      // Grant ORGANIZER_ROLE to user1
      await roleManager.grantRole(await roleManager.ORGANIZER_ROLE(), user1.address);
      
      // Check if user1 can create a tribe
      await expect(tribeController.connect(user1).createTribe(
        "Test Tribe",
        "ipfs://metadata",
        [user1.address],
        0, // PUBLIC
        0,
        []
      )).to.not.be.reverted;
    });
  });
}); 