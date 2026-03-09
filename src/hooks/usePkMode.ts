import { useState, useEffect, useCallback } from 'react';
import { pkSocket } from '../services/pk-socket';
import { useAuth } from './useAuth';

interface PkPlayer {
  id: number;
  username: string;
  avatar: string;
  score: number;
  isReady: boolean;
}

export const usePkMode = (matchId: number) => {
  const { user } = useAuth();
  const [players, setPlayers] = useState<PkPlayer[]>([]);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [matchEnded, setMatchEnded] = useState(false);
  const [winner, setWinner] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;

    // Connect socket
    pkSocket.connect();
    pkSocket.joinMatch(matchId, user.id);

    // Set up listeners
    pkSocket.onPlayerJoined((data) => {
      console.log('Player joined:', data.userId);
    });

    pkSocket.onPlayerReady((data) => {
      setPlayers(prev => 
        prev.map(p => p.id === data.userId ? { ...p, isReady: true } : p)
      );
    });

    pkSocket.onCountdownStart((data) => {
      setCountdown(data.seconds);
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            clearInterval(interval);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    });

    pkSocket.onGameStart(() => {
      setGameStarted(true);
      setCountdown(null);
    });

    pkSocket.onScoreUpdate((data) => {
      if (data.userId === user.id) {
        setMyScore(data.score);
      } else {
        setOpponentScore(data.score);
      }
    });

    pkSocket.onMatchEnd((data) => {
      setMatchEnded(true);
      setWinner(data.winnerId);
    });

    pkSocket.onPlayerLeft((data) => {
      console.log('Player left:', data.userId);
      // Handle player disconnect
    });

    return () => {
      pkSocket.leaveMatch();
      pkSocket.removeAllListeners();
    };
  }, [matchId, user]);

  const setReady = useCallback(() => {
    if (!user) return;
    pkSocket.setReady(matchId, user.id);
  }, [matchId, user]);

  const updateScore = useCallback((score: number) => {
    if (!user) return;
    setMyScore(score);
    pkSocket.updateScore(matchId, user.id, score);
  }, [matchId, user]);

  const endGame = useCallback((finalScore: number) => {
    if (!user) return;
    pkSocket.gameOver(matchId, user.id, finalScore);
  }, [matchId, user]);

  const sendChat = useCallback((message: string) => {
    if (!user) return;
    pkSocket.sendChat(matchId, user.id, message);
  }, [matchId, user]);

  return {
    players,
    myScore,
    opponentScore,
    gameStarted,
    countdown,
    matchEnded,
    winner,
    setReady,
    updateScore,
    endGame,
    sendChat
  };
};
