import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('png');   // pixel art tetap tajam sebelum encode
Config.setCodec('h264');
Config.setCrf(16);
