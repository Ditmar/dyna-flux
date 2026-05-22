import React from 'react';
import type { HeaderProps } from './top-bar.types';
import styles from './top-bar.module.scss';
import { Play, Square, GitBranch, FileCode } from 'lucide-react';

const Header = (props: HeaderProps) => {
  const { user, play, visibleForrester, baseModel } = props;
  const [isPlaying, setPlaying] = React.useState(false);
  const [isForresterVisible, setForresterVisible] = React.useState(false);

  const handlerPlay = () => {
    const next = !isPlaying;
    setPlaying(next);
    play(next);
  };

  const showForrester = () => {
    const next = !isForresterVisible;
    setForresterVisible(next);
    visibleForrester(next);
  };

  return (
    <div className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.brandName}>dyna-flux</span>
      </div>

      <div className={styles.actions}>
        <button
          className={`${styles.btn} ${isPlaying ? styles.btnActive : styles.btnPlay}`}
          onClick={handlerPlay}
          title={isPlaying ? 'Stop simulation' : 'Run simulation'}
        >
          {isPlaying ? <Square size={15} /> : <Play size={15} />}
          {isPlaying ? 'Stop' : 'Play'}
        </button>

        <button
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={baseModel}
          title="Load base model template"
        >
          <FileCode size={15} />
          Base Model
        </button>

        <button
          className={`${styles.btn} ${isForresterVisible ? styles.btnActive : styles.btnSecondary}`}
          onClick={showForrester}
          title="Toggle Forrester diagram"
        >
          <GitBranch size={15} />
          Forrester
        </button>
      </div>

      {user?.name && <span className={styles.user}>{user.name}</span>}
    </div>
  );
};
export default Header;
