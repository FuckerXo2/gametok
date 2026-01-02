// Tic-Tac-Toe Multiplayer Game Component
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BOARD_SIZE = Math.min(SCREEN_WIDTH - 60, 320);
const CELL_SIZE = BOARD_SIZE / 3;

interface TicTacToeGameProps {
  gameState: {
    board: (string | null)[];
    symbols: Record<string, string>;
  };
  onMove: (move: { position: number }) => void;
  isMyTurn: boolean;
  mySymbol: string;
  colors: any;
}

const TicTacToeGame: React.FC<TicTacToeGameProps> = ({
  gameState,
  onMove,
  isMyTurn,
  mySymbol,
  colors,
}) => {
  const handleCellPress = (index: number) => {
    if (!isMyTurn || gameState.board[index] !== null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onMove({ position: index });
  };

  const renderCell = (index: number) => {
    const value = gameState.board[index];
    const isX = value === 'X';
    const isO = value === 'O';

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.cell,
          { borderColor: colors.border },
          index % 3 !== 2 && styles.cellRightBorder,
          index < 6 && styles.cellBottomBorder,
        ]}
        onPress={() => handleCellPress(index)}
        activeOpacity={0.7}
        disabled={!isMyTurn || value !== null}
      >
        {isX && <Text style={[styles.symbol, styles.symbolX]}>X</Text>}
        {isO && <Text style={[styles.symbol, styles.symbolO]}>O</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.symbolIndicator}>
        <Text style={[styles.symbolLabel, { color: colors.textSecondary }]}>
          You are playing as
        </Text>
        <Text style={[
          styles.mySymbol,
          mySymbol === 'X' ? styles.symbolX : styles.symbolO
        ]}>
          {mySymbol}
        </Text>
      </View>

      <View style={[styles.board, { backgroundColor: colors.surface }]}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(renderCell)}
      </View>

      {!isMyTurn && (
        <Text style={[styles.waitingText, { color: colors.textSecondary }]}>
          Waiting for opponent...
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 20,
  },
  symbolIndicator: {
    alignItems: 'center',
    marginBottom: 30,
  },
  symbolLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  mySymbol: {
    fontSize: 48,
    fontWeight: '800',
  },
  board: {
    width: BOARD_SIZE,
    height: BOARD_SIZE,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 16,
    overflow: 'hidden',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellRightBorder: {
    borderRightWidth: 2,
  },
  cellBottomBorder: {
    borderBottomWidth: 2,
  },
  symbol: {
    fontSize: 64,
    fontWeight: '800',
  },
  symbolX: {
    color: '#667eea',
  },
  symbolO: {
    color: '#f5576c',
  },
  waitingText: {
    marginTop: 30,
    fontSize: 16,
  },
});

export default TicTacToeGame;
