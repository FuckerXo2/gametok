import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { usePkMode } from '../hooks/usePkMode';
import { PkOverlay } from '../components/PkOverlay';
import { PkCountdown } from '../components/PkCountdown';
import { PkResults } from '../components/PkResults';
import { LoopsColors } from '../constants/LoopsColors';
import { FontStyles } from '../constants/LoopsFonts';

interface Props {
  route: {
    params: {
      matchId: number;
      game: any;
      opponent: any;
    };
  };
  navigation: any;
}

const PK_INJECTION_SCRIPT = `
  (function() {
    console.log('PK Mode injection script loaded');
    
    // Intercept score changes
    let _score = 0;
    Object.defineProperty(window, 'score', {
      get: () => _score,
      set: (value) => {
        _score = value;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'score_update',
          score: value
        }));
      }
    });
    
    // Intercept game over
    const originalGameOver = window.gameOver;
    window.gameOver = function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'game_over',
        score: window.score || _score
      }));
      if (originalGameOver) originalGameOver.apply(this, arguments);
    };
    
    // Send periodic updates
    setInterval(() => {
      if (window.score !== undefined && window.score !== _score) {
        _score = window.score;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'score_update',
          score: _score
        }));
      }
    }, 500);
    
    // Notify that injection is complete
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'injection_ready'
    }));
  })();
`;

export const PkModeScreen: React.FC<Props> = ({ route, navigation }) => {
  const { matchId, game, opponent } = route.params;
  const webviewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  
  const {
    myScore,
    opponentScore,
    gameStarted,
    countdown,
    matchEnded,
    winner,
    setReady,
    updateScore,
    endGame
  } = usePkMode(matchId);

  const handleGameMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'injection_ready') {
        console.log('PK injection ready');
      }
      
      if (data.type === 'score_update') {
        updateScore(data.score);
      }
      
      if (data.type === 'game_over') {
        endGame(data.score);
      }
    } catch (error) {
      console.error('Error parsing game message:', error);
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  // Auto-ready when component mounts
  useEffect(() => {
    setReady();
  }, [setReady]);

  if (matchEnded) {
    return (
      <PkResults
        matchId={matchId}
        myScore={myScore}
        opponentScore={opponentScore}
        winner={winner}
        opponent={opponent}
        onClose={handleClose}
      />
    );
  }

  return (
    <View style={styles.container}>
      {countdown !== null && (
        <PkCountdown seconds={countdown} />
      )}
      
      {!gameStarted && countdown === null && (
        <View style={styles.waitingContainer}>
          <ActivityIndicator size="large" color={LoopsColors.primary} />
          <Text style={styles.waitingText}>Waiting for opponent...</Text>
        </View>
      )}
      
      {gameStarted && (
        <>
          <PkOverlay
            myScore={myScore}
            opponentScore={opponentScore}
            opponent={opponent}
          />
          
          <WebView
            ref={webviewRef}
            source={{ uri: game.url }}
            onMessage={handleGameMessage}
            injectedJavaScript={PK_INJECTION_SCRIPT}
            style={styles.webview}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
          />
          
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={LoopsColors.primary} />
            </View>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LoopsColors.background
  },
  webview: {
    flex: 1
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: LoopsColors.background
  },
  waitingText: {
    ...FontStyles.body,
    color: LoopsColors.textSecondary,
    marginTop: 16
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: LoopsColors.background,
    justifyContent: 'center',
    alignItems: 'center'
  }
});
