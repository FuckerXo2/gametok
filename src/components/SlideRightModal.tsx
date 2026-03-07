import React, { useState, useEffect, useRef } from 'react';
import { Modal, Animated, PanResponder, StyleSheet, Dimensions, View } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SlideRightModalProps {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

export const SlideRightModal: React.FC<SlideRightModalProps> = ({ visible, onClose, children }) => {
    const [showModal, setShowModal] = useState(visible);
    const translateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;

    useEffect(() => {
        if (visible) {
            setShowModal(true);
            Animated.spring(translateX, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 0,
                speed: 20,
            }).start();
        } else {
            Animated.timing(translateX, {
                toValue: SCREEN_WIDTH,
                duration: 250,
                useNativeDriver: true,
            }).start(() => setShowModal(false));
        }
    }, [visible]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                // Only trigger if swiping strongly to the right from the left edge
                return gestureState.dx > 10 && gestureState.vx > 0.3 && gestureState.x0 < 50;
            },
            onPanResponderMove: (evt, gestureState) => {
                if (gestureState.dx > 0) {
                    translateX.setValue(gestureState.dx);
                }
            },
            onPanResponderRelease: (evt, gestureState) => {
                if (gestureState.dx > SCREEN_WIDTH / 3 || gestureState.vx > 1) {
                    // Swipe out
                    Animated.timing(translateX, {
                        toValue: SCREEN_WIDTH,
                        duration: 200,
                        useNativeDriver: true,
                    }).start(() => onClose());
                } else {
                    // Snap back
                    Animated.spring(translateX, {
                        toValue: 0,
                        useNativeDriver: true,
                        bounciness: 0,
                        speed: 20,
                    }).start();
                }
            },
        })
    ).current;

    return (
        <Modal visible={showModal} transparent animationType="none" onRequestClose={onClose}>
            <View style={StyleSheet.absoluteFill}>
                <Animated.View
                    style={[styles.container, { transform: [{ translateX }] }]}
                    {...panResponder.panHandlers}
                >
                    {children}
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: SCREEN_WIDTH,
        shadowColor: '#000',
        shadowOffset: { width: -5, height: 0 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 5,
    },
});
