// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.6.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/presets/ERC20PresetMinterPauser.sol";

contract USDX is ERC20PresetMinterPauser {

  constructor() ERC20PresetMinterPauser("", "") public {

  }
}