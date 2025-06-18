"use client";
import { useState, useEffect } from "react";
import styles from "./WalletButton.module.css"; 
import {useLogin, usePrivy} from '@privy-io/react-auth';

function LogoutButton() {
  const { ready, authenticated, logout } = usePrivy();

  // Disable logout when Privy is not ready or the user is not authenticated
  const disableLogout = !ready || (ready && !authenticated);

  return (
    <button disabled={disableLogout} onClick={logout}>
      Log out
    </button>
  );
}


function LoginButton() {
    const { ready, authenticated} = usePrivy();
    const { login } = useLogin();
    // Disable login when Privy is not ready or the user is already authenticated
    const disableLogin = !ready || (ready && authenticated);

    return (
        <button disabled={disableLogin} onClick={() => login({
                        loginMethods: ['wallet'],
                        walletChainType: 'ethereum-and-solana',
                        disableSignup: false
                    })}>
            Log in
        </button>
    );
}

const WalletButton = () => {

    const { ready, authenticated } = usePrivy();
    const { login } = useLogin();
    // Disable login when Privy is not ready or the user is already authenticated
    const disableLogin = !ready || (ready && !authenticated);

    return (
        <div>
            <div className={styles['wallet-container']}>
            {authenticated ? (
                <LogoutButton />
            ) : (
                <LoginButton />
            )}
            </div>
        </div>
    );
};

export default WalletButton;
