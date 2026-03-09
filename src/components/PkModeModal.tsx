import React from 'react';
import { Modal, StyleSheet } from 'react-native';
import { PkModeScreen } from '../screens/PkModeScreen';

interface Props {
  visible: boolean;
  matchId: number;
  game: any;
  opponent: any;
  onClose: () => void;
}

export const PkModeModal: React.FC<Props> = ({ visible, matchId, game, opponent, onClose }) => {
  const navigation = {
    goBack: onClose
  };

  const route = {
    params: {
      matchId,
      game,
      opponent
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <PkModeScreen route={route} navigation={navigation} />
    </Modal>
  );
};

const styles = StyleSheet.create({});
