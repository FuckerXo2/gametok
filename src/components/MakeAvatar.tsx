// Sign-up's "make your avatar": who you are first (build, skin, hair, a starter outfit), shopping comes later.
// Everything here is free. It's saved on the account like any change in Me.
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { AvatarStage } from './AvatarStage';
import { AVATAR_ITEMS, AvatarRecord, DEFAULT_AVATAR, thumbOf } from '../avatar/catalog';
import { saveAvatar, syncAvatar, useAvatar } from '../avatar/store';

const H = Dimensions.get('window').height;
const byId = (id: string) => AVATAR_ITEMS.find((i) => i.id === id)!;
const STARTER_OUTFITS: { id: string; name: string; set: string }[] = [
  { id: 'Male_Ranger-top', name: 'Ranger', set: 'Male_Ranger' },
  { id: 'Male_Peasant-top', name: 'Peasant', set: 'Male_Peasant' },
];
const outfit = (r: AvatarRecord, set: string): AvatarRecord => ({ ...r, parts: { ...r.parts, top: set, arms: set, legs: set, feet: set } });

export const MakeAvatar: React.FC<{ textColor: string; dimColor: string }> = ({ textColor, dimColor }) => {
  const look = useAvatar() ?? DEFAULT_AVATAR;
  useEffect(() => { syncAvatar(); }, []);   // just signed up: from now on it's saved on the account
  const set = (r: AvatarRecord) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); saveAvatar(r); };

  const Choice = ({ on, onPress, children }: { on: boolean; onPress: () => void; children: React.ReactNode }) => (
    <Pressable onPress={onPress} style={[styles.choice, on && styles.choiceOn]}>{children}</Pressable>
  );
  const Pic = ({ id }: { id: string }) => <Image source={{ uri: thumbOf(byId(id))! }} style={styles.pic} resizeMode="contain" />;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.stage}><AvatarStage style={StyleSheet.absoluteFill} avatar={look} look="dark" /></View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.label, { color: dimColor }]}>BUILD</Text>
        <View style={styles.row}>
          {(['Male', 'Female'] as const).map((b) => (
            <Choice key={b} on={look.body === b} onPress={() => set({ ...look, body: b })}>
              <Pic id={`body-${b}`} /><Text style={[styles.name, { color: textColor }]}>{byId(`body-${b}`).name}</Text>
            </Choice>
          ))}
        </View>
        <Text style={[styles.label, { color: dimColor }]}>SKIN</Text>
        <View style={styles.dots}>
          {AVATAR_ITEMS.filter((i) => i.id.startsWith('skin-')).map((i, k) => (
            <Pressable key={i.id} onPress={() => set({ ...look, skin: k })} style={[styles.dot, { backgroundColor: i.tint }, look.skin === k && styles.dotOn]} />
          ))}
        </View>
        <Text style={[styles.label, { color: dimColor }]}>HAIR</Text>
        <View style={styles.row}>
          <Choice on={look.hair === 'Hair_Buzzed'} onPress={() => set({ ...look, hair: 'Hair_Buzzed' })}>
            <Pic id="hair-Hair_Buzzed" /><Text style={[styles.name, { color: textColor }]}>Buzz Cut</Text>
          </Choice>
          <Choice on={!look.hair} onPress={() => set({ ...look, hair: null })}>
            <View style={[styles.pic, { alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 30 }}>✕</Text></View>
            <Text style={[styles.name, { color: textColor }]}>None</Text>
          </Choice>
        </View>
        <Text style={[styles.label, { color: dimColor }]}>OUTFIT</Text>
        <View style={styles.row}>
          {STARTER_OUTFITS.map((o) => (
            <Choice key={o.id} on={look.parts.top === o.set} onPress={() => set(outfit(look, o.set))}>
              <Pic id={o.id} /><Text style={[styles.name, { color: textColor }]}>{o.name}</Text>
            </Choice>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  stage: { height: H * 0.3, borderRadius: 24, overflow: 'hidden', marginHorizontal: 20, marginBottom: 6 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginTop: 16, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 10 },
  choice: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, borderWidth: 2, borderColor: 'transparent', padding: 8, alignItems: 'center' },
  choiceOn: { borderColor: '#a855f7', backgroundColor: 'rgba(168,85,247,0.12)' },
  pic: { width: '100%', height: 84 },
  name: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  dots: { flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: 'transparent' },
  dotOn: { borderColor: '#fff' },
});
