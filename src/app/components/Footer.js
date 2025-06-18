"use client";
import styles from "./Footer.module.css";
import WalletButton from "./WalletButton";

export default function Footer() {

  return (
    <div className={styles.Footer}>
        <WalletButton />
    </div>
  );
}
