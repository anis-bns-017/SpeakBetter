-- The effect others see around someone's avatar while they talk in voice rooms (null = the classic glow)
ALTER TABLE "User" ADD COLUMN "speakingEffect" TEXT;
