import React from 'react';
import type { HeaderProps } from './top-bar.types';
import styles from './top-bar.module.scss';

const Header = (props: HeaderProps) => {
  const { user, play, visibleForrester } = props;
  const [playText, setPlayText] = React.useState(false);
  const [isVisible, setVisible] = React.useState(false);
  const handlerPlay = () => {
    setPlayText(!playText);
    play(!playText);
  };
  const showForrester = () => {
    setVisible(!isVisible)
    visibleForrester(!isVisible)
  }
  return (
    <div className={styles.header}>
      <button onClick={handlerPlay}>Play</button>
      <button onClick={showForrester}>Show Forrester</button>
      <h1>{user?.name}</h1>
    </div>
  );
};
export default Header;
