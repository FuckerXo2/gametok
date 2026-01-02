// Connect4 Multiplayer Game Component
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BOARD_WIDTH = Math.min(SCREEN_WIDTH - 40, 350);
const CELL_SIZE = BOARD_WIDTH / 7;

interface Connect4GameProps {
  gameState: {
    board: (string | null)[][];
    symbols: Record<string, string>;
  };
  onMove: (move: { column: number }) => void;
  isMyTurn: boolean;
  mySymbol: string;
  colors: any;
}

const Connect4Game: React.FC<Connect4GameProps> = ({
  gameState,
  onMove,
  isMyTurn,
  mySymbol,
  colors,
}) => {
  const handleColumnPress = (column: number) => {
    if (!isMyTurn) return;
    // Check if column is full
    if (gameState.board[0][column] !== null) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onMove({ column });
  };

  const getChipColor = (value: string | null) => {
    if (value === 'red') return '#ef4444';
    if (value === 'yellow') return '#eab308';
    return 'transparent';
  };

  return (
    <View style={styles.container}>
      <View style={styles.colorIndicator}>
        <Text style={[styles.colorLabel, { color: colors.textSecondary }]}>
          You are
        </Text>
        <View style={[
          styles.colorChip,
          { backgroundColor: mySymbol === 'red' ? '#ef4444' : '#eab308' }
        ]} />
      </View>

      {/* Column buttons */}
      <View style={styles.columnButtons}>
        {[0, 1, 2, 3, 4, 5, 6].map(col => (
          <TouchableOpacity
            key={col}
            style={[
              styles.columnBtn,
              isMyTurn && gameState.board[0][col] === null && styles.columnBtnActive,
            ]}
            onPress={() => handleColumnPress(col)}
            disabled={!isMyTurn || gameState.board[0][col] !== null}
          >
            <View style={[
              styles.dropIndicator,
              { backgroundColor: isMyTurn ? (mySymbol === 'red' ? '#ef4444' : '#eab308') : 'transparent' }
            ]} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Board */}
      <View style={[styles.board, { backgroundColor: '#1e40af' }]}>
        {gameState.board.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((cell, colIndex) => (
              <View key={colIndex} style={styles.cell}>
                <View style={[styles.hole, { backgroundColor: colors.background }]}>
                  {cell && (
                    <View style={[styles.chip, { backgroundColor: getChipColor(cell) }]} />
                  )}
                </View>
              </View>
            ))}
          </View>
        ))}
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
    paddingTop: 10,
  },
  colorIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  colorLabel: {
    fontSize: 16,
  },
  colorChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  columnButtons: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  columnBtn: {
    width: CELL_SIZE,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.3,
  },
  columnBtnActive: {
    opacity: 1,
  },
  dropIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  board: {
    borderRadius: 12,
    padding: 8,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hole: {
    width: CELL_SIZE - 8,
    height: CELL_SIZE - 8,
    borderRadius: (CELL_SIZE - 8) / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chip: {
    width: CELL_SIZE - 12,
    height: CELL_SIZE - 12,
    borderRadius: (CELL_SIZE - 12) / 2,
  },
  waitingText: {
    marginTop: 20,
    fontSize: 16,
  },
});

export default Connect4Game;
