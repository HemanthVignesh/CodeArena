import { PrismaClient, Difficulty, Language, Role } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding CodeArena database...");

  // 1. Create Default Admin User & Normal User
  const adminPasswordHash = await argon2.hash("AdminPass123!", {
    type: argon2.argon2id,
  });
  const userPasswordHash = await argon2.hash("UserPass123!", {
    type: argon2.argon2id,
  });

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@codearena.com" },
    update: {},
    create: {
      email: "admin@codearena.com",
      username: "admin",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      profile: {
        create: {
          rating: 2400,
          totalSolved: 10,
          easySolved: 4,
          mediumSolved: 4,
          hardSolved: 2,
          totalSubmissions: 25,
          currentStreak: 14,
          maxStreak: 30,
        },
      },
    },
  });

  const demoUser = await prisma.user.upsert({
    where: { email: "demo@codearena.com" },
    update: {},
    create: {
      email: "demo@codearena.com",
      username: "demo_coder",
      passwordHash: userPasswordHash,
      role: Role.USER,
      profile: {
        create: {
          rating: 1450,
          totalSolved: 5,
          easySolved: 3,
          mediumSolved: 2,
          hardSolved: 0,
          totalSubmissions: 12,
          currentStreak: 3,
          maxStreak: 7,
        },
      },
    },
  });

  console.log(
    `Created admin user: ${adminUser.username} and demo user: ${demoUser.username}`,
  );

  // 2. Define Problem Dataset (10 original problems)
  const problemsData = [
    {
      title: "Pair Sum Target",
      slug: "pair-sum-target",
      difficulty: Difficulty.EASY,
      statement:
        "Given an array of integers `numbers` and an integer `target`, return the 0-based indices of the two numbers such that they add up to `target`.\n\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.",
      inputFormat:
        "First line contains integer N (size of array). Second line contains N space-separated integers. Third line contains integer target.",
      outputFormat: "Two space-separated indices in ascending order.",
      constraints:
        "2 <= numbers.length <= 10^4\n-10^9 <= numbers[i] <= 10^9\n-10^9 <= target <= 10^9",
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      isPublished: true,
      totalAccepted: 1420,
      totalSubmissions: 2100,
      acceptanceRate: 67.6,
      tags: ["Arrays", "Hashing", "Two Pointers"],
      templates: [
        {
          language: Language.PYTHON,
          boilerPlate:
            "def pair_sum(numbers: list[int], target: int) -> list[int]:\n    # Return [index1, index2]\n    pass\n\nif __name__ == '__main__':\n    import sys\n    lines = sys.stdin.read().splitlines()\n    if lines:\n        n = int(lines[0])\n        nums = list(map(int, lines[1].split()))\n        t = int(lines[2])\n        ans = pair_sum(nums, t)\n        print(f\"{ans[0]} {ans[1]}\")",
        },
        {
          language: Language.CPP,
          boilerPlate:
            '#include <iostream>\n#include <vector>\n#include <unordered_map>\n\nusing namespace std;\n\nvector<int> pairSum(const vector<int>& nums, int target) {\n    // Write your code here\n    return {};\n}\n\nint main() {\n    int n;\n    if (cin >> n) {\n        vector<int> nums(n);\n        for (int i = 0; i < n; ++i) cin >> nums[i];\n        int target;\n        cin >> target;\n        auto ans = pairSum(nums, target);\n        cout << ans[0] << " " << ans[1] << endl;\n    }\n    return 0;\n}',
        },
        {
          language: Language.TYPESCRIPT,
          boilerPlate:
            "function pairSum(nums: number[], target: number): number[] {\n    // Return [index1, index2]\n    return [];\n}\n\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8').trim().split('\\n');\nif (input.length >= 3) {\n    const nums = input[1].trim().split(/\\s+/).map(Number);\n    const target = Number(input[2]);\n    const res = pairSum(nums, target);\n    console.log(`${res[0]} ${res[1]}`);\n}",
        },
      ],
      testCases: [
        {
          inputData: "4\n2 7 11 15\n9",
          expectedOutput: "0 1",
          isSample: true,
          isHidden: false,
          orderIndex: 0,
          explanation:
            "numbers[0] + numbers[1] == 2 + 7 == 9, so indices 0 and 1 are returned.",
        },
        {
          inputData: "3\n3 2 4\n6",
          expectedOutput: "1 2",
          isSample: true,
          isHidden: false,
          orderIndex: 1,
          explanation:
            "numbers[1] + numbers[2] == 2 + 4 == 6, so indices 1 and 2 are returned.",
        },
        {
          inputData: "2\n3 3\n6",
          expectedOutput: "0 1",
          isSample: false,
          isHidden: true,
          orderIndex: 2,
        },
        {
          inputData: "5\n-3 4 3 90 2\n0",
          expectedOutput: "0 2",
          isSample: false,
          isHidden: true,
          orderIndex: 3,
        },
      ],
    },
    {
      title: "Valid Anagram Checker",
      slug: "valid-anagram-checker",
      difficulty: Difficulty.EASY,
      statement:
        "Given two strings `s` and `t`, return `true` if `t` is an anagram of `s`, and `false` otherwise.\n\nAn Anagram is a word formed by rearranging the letters of a different word, typically using all the original letters exactly once.",
      inputFormat:
        "First line contains string s. Second line contains string t.",
      outputFormat: "Print 'true' or 'false'.",
      constraints:
        "1 <= s.length, t.length <= 5 * 10^4\ns and t consist of lowercase English letters.",
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      isPublished: true,
      totalAccepted: 980,
      totalSubmissions: 1250,
      acceptanceRate: 78.4,
      tags: ["Strings", "Hashing"],
      templates: [
        {
          language: Language.PYTHON,
          boilerPlate:
            "def is_anagram(s: str, t: str) -> bool:\n    pass\n\nif __name__ == '__main__':\n    import sys\n    lines = sys.stdin.read().splitlines()\n    if len(lines) >= 2:\n        print('true' if is_anagram(lines[0], lines[1]) else 'false')",
        },
        {
          language: Language.CPP,
          boilerPlate:
            '#include <iostream>\n#include <string>\n\nusing namespace std;\n\nbool isAnagram(string s, string t) {\n    return false;\n}\n\nint main() {\n    string s, t;\n    if (cin >> s >> t) {\n        cout << (isAnagram(s, t) ? "true" : "false") << endl;\n    }\n    return 0;\n}',
        },
        {
          language: Language.TYPESCRIPT,
          boilerPlate:
            "function isAnagram(s: string, t: string): boolean {\n    return false;\n}\n\nconst fs = require('fs');\nconst lines = fs.readFileSync(0, 'utf-8').trim().split('\\n');\nif (lines.length >= 2) {\n    console.log(isAnagram(lines[0].trim(), lines[1].trim()) ? 'true' : 'false');\n}",
        },
      ],
      testCases: [
        {
          inputData: "anagram\nnagaram",
          expectedOutput: "true",
          isSample: true,
          isHidden: false,
          orderIndex: 0,
          explanation:
            "All letters in 'anagram' can be rearranged to form 'nagaram'.",
        },
        {
          inputData: "rat\ncar",
          expectedOutput: "false",
          isSample: true,
          isHidden: false,
          orderIndex: 1,
          explanation: "'car' has 'c' which is not in 'rat'.",
        },
        {
          inputData: "a\na",
          expectedOutput: "true",
          isSample: false,
          isHidden: true,
          orderIndex: 2,
        },
        {
          inputData: "ab\na",
          expectedOutput: "false",
          isSample: false,
          isHidden: true,
          orderIndex: 3,
        },
      ],
    },
    {
      title: "Longest Substring Without Repeating Characters",
      slug: "longest-substring-without-repeating-characters",
      difficulty: Difficulty.MEDIUM,
      statement:
        "Given a string `s`, find the length of the longest substring without repeating characters.",
      inputFormat: "A single line containing string s.",
      outputFormat:
        "A single integer denoting the length of the longest unique substring.",
      constraints:
        "0 <= s.length <= 5 * 10^4\ns consists of English letters, digits, symbols and spaces.",
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      isPublished: true,
      totalAccepted: 820,
      totalSubmissions: 1750,
      acceptanceRate: 46.8,
      tags: ["Strings", "Two Pointers", "Sliding Window"],
      templates: [
        {
          language: Language.PYTHON,
          boilerPlate:
            "def length_of_longest_substring(s: str) -> int:\n    pass\n\nif __name__ == '__main__':\n    import sys\n    text = sys.stdin.read().rstrip('\\n')\n    print(length_of_longest_substring(text))",
        },
        {
          language: Language.CPP,
          boilerPlate:
            "#include <iostream>\n#include <string>\n\nusing namespace std;\n\nint lengthOfLongestSubstring(string s) {\n    return 0;\n}\n\nint main() {\n    string s;\n    if (getline(cin, s)) {\n        cout << lengthOfLongestSubstring(s) << endl;\n    }\n    return 0;\n}",
        },
        {
          language: Language.TYPESCRIPT,
          boilerPlate:
            "function lengthOfLongestSubstring(s: string): number {\n    return 0;\n}\n\nconst fs = require('fs');\nconst s = fs.readFileSync(0, 'utf-8').replace(/\\r?\\n$/, '');\nconsole.log(lengthOfLongestSubstring(s));",
        },
      ],
      testCases: [
        {
          inputData: "abcabcbb",
          expectedOutput: "3",
          isSample: true,
          isHidden: false,
          orderIndex: 0,
          explanation: "The answer is 'abc', with length 3.",
        },
        {
          inputData: "bbbbb",
          expectedOutput: "1",
          isSample: true,
          isHidden: false,
          orderIndex: 1,
          explanation: "The answer is 'b', with length 1.",
        },
        {
          inputData: "pwwkew",
          expectedOutput: "3",
          isSample: true,
          isHidden: false,
          orderIndex: 2,
          explanation: "The answer is 'wke', with length 3.",
        },
        {
          inputData: "",
          expectedOutput: "0",
          isSample: false,
          isHidden: true,
          orderIndex: 3,
        },
        {
          inputData: "dvdf",
          expectedOutput: "3",
          isSample: false,
          isHidden: true,
          orderIndex: 4,
        },
      ],
    },
    {
      title: "Balanced Parentheses Validator",
      slug: "balanced-parentheses-validator",
      difficulty: Difficulty.EASY,
      statement:
        "Given a string `s` containing just the characters `'('`, `')'`, `'{'`, `'}'`, `'['` and `']'`, determine if the input string is valid.\n\nAn input string is valid if:\n1. Open brackets must be closed by the same type of brackets.\n2. Open brackets must be closed in the correct order.\n3. Every close bracket has a corresponding open bracket of the same type.",
      inputFormat: "A single line containing the string s.",
      outputFormat: "Print 'true' if valid, otherwise 'false'.",
      constraints:
        "1 <= s.length <= 10^4\ns consists of parentheses only '()[]{}'.",
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      isPublished: true,
      totalAccepted: 1100,
      totalSubmissions: 1500,
      acceptanceRate: 73.3,
      tags: ["Stack", "Strings"],
      templates: [
        {
          language: Language.PYTHON,
          boilerPlate:
            "def is_valid_parentheses(s: str) -> bool:\n    pass\n\nif __name__ == '__main__':\n    import sys\n    s = sys.stdin.read().strip()\n    print('true' if is_valid_parentheses(s) else 'false')",
        },
        {
          language: Language.CPP,
          boilerPlate:
            '#include <iostream>\n#include <string>\n\nusing namespace std;\n\nbool isValid(string s) {\n    return false;\n}\n\nint main() {\n    string s;\n    if (cin >> s) {\n        cout << (isValid(s) ? "true" : "false") << endl;\n    }\n    return 0;\n}',
        },
        {
          language: Language.TYPESCRIPT,
          boilerPlate:
            "function isValid(s: string): boolean {\n    return false;\n}\n\nconst fs = require('fs');\nconst s = fs.readFileSync(0, 'utf-8').trim();\nconsole.log(isValid(s) ? 'true' : 'false');",
        },
      ],
      testCases: [
        {
          inputData: "()",
          expectedOutput: "true",
          isSample: true,
          isHidden: false,
          orderIndex: 0,
        },
        {
          inputData: "()[]{}",
          expectedOutput: "true",
          isSample: true,
          isHidden: false,
          orderIndex: 1,
        },
        {
          inputData: "(]",
          expectedOutput: "false",
          isSample: true,
          isHidden: false,
          orderIndex: 2,
        },
        {
          inputData: "([)]",
          expectedOutput: "false",
          isSample: false,
          isHidden: true,
          orderIndex: 3,
        },
        {
          inputData: "{[]}",
          expectedOutput: "true",
          isSample: false,
          isHidden: true,
          orderIndex: 4,
        },
      ],
    },
    {
      title: "Rotated Sorted Array Search",
      slug: "rotated-sorted-array-search",
      difficulty: Difficulty.MEDIUM,
      statement:
        "There is an integer array `nums` sorted in ascending order (with distinct values).\n\nPrior to being passed to your function, `nums` is possibly rotated at an unknown pivot index `k` (`1 <= k < nums.length`).\n\nGiven the array `nums` after the possible rotation and an integer `target`, return the index of `target` if it is in `nums`, or `-1` if it is not in `nums`.\n\nYou must write an algorithm with `O(log n)` runtime complexity.",
      inputFormat:
        "First line contains integer N. Second line contains N space-separated integers. Third line contains integer target.",
      outputFormat: "Index of target or -1.",
      constraints:
        "1 <= nums.length <= 5000\n-10^4 <= nums[i] <= 10^4\nAll values of nums are unique.\nnums is an ascending array that is possibly rotated.",
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      isPublished: true,
      totalAccepted: 650,
      totalSubmissions: 1400,
      acceptanceRate: 46.4,
      tags: ["Arrays", "Binary Search"],
      templates: [
        {
          language: Language.PYTHON,
          boilerPlate:
            "def search(nums: list[int], target: int) -> int:\n    pass\n\nif __name__ == '__main__':\n    import sys\n    lines = sys.stdin.read().splitlines()\n    if lines:\n        n = int(lines[0])\n        nums = list(map(int, lines[1].split()))\n        target = int(lines[2])\n        print(search(nums, target))",
        },
        {
          language: Language.CPP,
          boilerPlate:
            "#include <iostream>\n#include <vector>\n\nusing namespace std;\n\nint search(vector<int>& nums, int target) {\n    return -1;\n}\n\nint main() {\n    int n;\n    if (cin >> n) {\n        vector<int> nums(n);\n        for (int i = 0; i < n; ++i) cin >> nums[i];\n        int target;\n        cin >> target;\n        cout << search(nums, target) << endl;\n    }\n    return 0;\n}",
        },
        {
          language: Language.TYPESCRIPT,
          boilerPlate:
            "function search(nums: number[], target: number): number {\n    return -1;\n}\n\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8').trim().split('\\n');\nif (input.length >= 3) {\n    const nums = input[1].trim().split(/\\s+/).map(Number);\n    const target = Number(input[2]);\n    console.log(search(nums, target));\n}",
        },
      ],
      testCases: [
        {
          inputData: "7\n4 5 6 7 0 1 2\n0",
          expectedOutput: "4",
          isSample: true,
          isHidden: false,
          orderIndex: 0,
        },
        {
          inputData: "7\n4 5 6 7 0 1 2\n3",
          expectedOutput: "-1",
          isSample: true,
          isHidden: false,
          orderIndex: 1,
        },
        {
          inputData: "1\n1\n0",
          expectedOutput: "-1",
          isSample: false,
          isHidden: true,
          orderIndex: 2,
        },
        {
          inputData: "5\n6 7 1 2 3\n1",
          expectedOutput: "2",
          isSample: false,
          isHidden: true,
          orderIndex: 3,
        },
      ],
    },
    {
      title: "Maximum Subarray Sum",
      slug: "maximum-subarray-sum",
      difficulty: Difficulty.MEDIUM,
      statement:
        "Given an integer array `nums`, find the contiguous subarray (containing at least one number) which has the largest sum and return its sum.",
      inputFormat:
        "First line contains integer N. Second line contains N space-separated integers.",
      outputFormat: "A single integer denoting the maximum sum.",
      constraints: "1 <= nums.length <= 10^5\n-10^4 <= nums[i] <= 10^4",
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      isPublished: true,
      totalAccepted: 910,
      totalSubmissions: 1600,
      acceptanceRate: 56.8,
      tags: ["Arrays", "Dynamic Programming"],
      templates: [
        {
          language: Language.PYTHON,
          boilerPlate:
            "def max_subarray(nums: list[int]) -> int:\n    pass\n\nif __name__ == '__main__':\n    import sys\n    lines = sys.stdin.read().splitlines()\n    if lines:\n        nums = list(map(int, lines[1].split()))\n        print(max_subarray(nums))",
        },
        {
          language: Language.CPP,
          boilerPlate:
            "#include <iostream>\n#include <vector>\n\nusing namespace std;\n\nint maxSubArray(vector<int>& nums) {\n    return 0;\n}\n\nint main() {\n    int n;\n    if (cin >> n) {\n        vector<int> nums(n);\n        for (int i = 0; i < n; ++i) cin >> nums[i];\n        cout << maxSubArray(nums) << endl;\n    }\n    return 0;\n}",
        },
        {
          language: Language.TYPESCRIPT,
          boilerPlate:
            "function maxSubArray(nums: number[]): number {\n    return 0;\n}\n\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8').trim().split('\\n');\nif (input.length >= 2) {\n    const nums = input[1].trim().split(/\\s+/).map(Number);\n    console.log(maxSubArray(nums));\n}",
        },
      ],
      testCases: [
        {
          inputData: "9\n-2 1 -3 4 -1 2 1 -5 4",
          expectedOutput: "6",
          isSample: true,
          isHidden: false,
          orderIndex: 0,
          explanation: "Subarray [4, -1, 2, 1] has the largest sum = 6.",
        },
        {
          inputData: "1\n1",
          expectedOutput: "1",
          isSample: true,
          isHidden: false,
          orderIndex: 1,
        },
        {
          inputData: "5\n5 4 -1 7 8",
          expectedOutput: "23",
          isSample: false,
          isHidden: true,
          orderIndex: 2,
        },
        {
          inputData: "3\n-3 -2 -1",
          expectedOutput: "-1",
          isSample: false,
          isHidden: true,
          orderIndex: 3,
        },
      ],
    },
    {
      title: "Merge Overlapping Intervals",
      slug: "merge-overlapping-intervals",
      difficulty: Difficulty.MEDIUM,
      statement:
        "Given an array of `intervals` where `intervals[i] = [start_i, end_i]`, merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.",
      inputFormat:
        "First line contains integer N (number of intervals). Next N lines each contain two integers start and end.",
      outputFormat:
        "Each merged interval printed on a new line as two space-separated integers, sorted by start time.",
      constraints:
        "1 <= intervals.length <= 10^4\nintervals[i].length == 2\n0 <= start_i <= end_i <= 10^4",
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      isPublished: true,
      totalAccepted: 740,
      totalSubmissions: 1520,
      acceptanceRate: 48.6,
      tags: ["Arrays", "Sorting"],
      templates: [
        {
          language: Language.PYTHON,
          boilerPlate:
            "def merge_intervals(intervals: list[list[int]]) -> list[list[int]]:\n    pass\n\nif __name__ == '__main__':\n    import sys\n    lines = sys.stdin.read().splitlines()\n    if lines:\n        n = int(lines[0])\n        intervals = [list(map(int, line.split())) for line in lines[1:n+1]]\n        res = merge_intervals(intervals)\n        for start, end in res:\n            print(f\"{start} {end}\")",
        },
        {
          language: Language.CPP,
          boilerPlate:
            '#include <iostream>\n#include <vector>\n#include <algorithm>\n\nusing namespace std;\n\nvector<vector<int>> merge(vector<vector<int>>& intervals) {\n    return {};\n}\n\nint main() {\n    int n;\n    if (cin >> n) {\n        vector<vector<int>> intervals(n, vector<int>(2));\n        for (int i = 0; i < n; ++i) cin >> intervals[i][0] >> intervals[i][1];\n        auto res = merge(intervals);\n        for (auto& iv : res) cout << iv[0] << " " << iv[1] << endl;\n    }\n    return 0;\n}',
        },
        {
          language: Language.TYPESCRIPT,
          boilerPlate:
            "function merge(intervals: number[][]): number[][] {\n    return [];\n}\n\nconst fs = require('fs');\nconst lines = fs.readFileSync(0, 'utf-8').trim().split('\\n');\nif (lines.length > 0) {\n    const n = parseInt(lines[0]);\n    const intervals = lines.slice(1, n + 1).map((l: string) => l.trim().split(/\\s+/).map(Number));\n    const res = merge(intervals);\n    res.forEach((iv: number[]) => console.log(`${iv[0]} ${iv[1]}`));\n}",
        },
      ],
      testCases: [
        {
          inputData: "4\n1 3\n2 6\n8 10\n15 18",
          expectedOutput: "1 6\n8 10\n15 18",
          isSample: true,
          isHidden: false,
          orderIndex: 0,
          explanation:
            "Since intervals [1,3] and [2,6] overlap, merge them into [1,6].",
        },
        {
          inputData: "2\n1 4\n4 5",
          expectedOutput: "1 5",
          isSample: true,
          isHidden: false,
          orderIndex: 1,
        },
        {
          inputData: "3\n1 4\n0 4\n3 5",
          expectedOutput: "0 5",
          isSample: false,
          isHidden: true,
          orderIndex: 2,
        },
      ],
    },
    {
      title: "Median of Two Sorted Arrays",
      slug: "median-of-two-sorted-arrays",
      difficulty: Difficulty.HARD,
      statement:
        "Given two sorted arrays `nums1` and `nums2` of size `m` and `n` respectively, return the median of the two sorted arrays.\n\nThe overall run time complexity should be `O(log (m+n))`.",
      inputFormat:
        "First line contains integer M. Second line contains M space-separated integers. Third line contains integer N. Fourth line contains N space-separated integers.",
      outputFormat: "Median formatted to 1 decimal place (e.g. 2.0 or 2.5).",
      constraints:
        "nums1.length == m\nnums2.length == n\n0 <= m <= 1000\n0 <= n <= 1000\n1 <= m + n <= 2000\n-10^6 <= nums1[i], nums2[i] <= 10^6",
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      isPublished: true,
      totalAccepted: 320,
      totalSubmissions: 950,
      acceptanceRate: 33.6,
      tags: ["Arrays", "Binary Search", "Divide and Conquer"],
      templates: [
        {
          language: Language.PYTHON,
          boilerPlate:
            "def find_median_sorted_arrays(nums1: list[int], nums2: list[int]) -> float:\n    pass\n\nif __name__ == '__main__':\n    import sys\n    lines = sys.stdin.read().splitlines()\n    m = int(lines[0])\n    nums1 = list(map(int, lines[1].split())) if m > 0 else []\n    n = int(lines[2])\n    nums2 = list(map(int, lines[3].split())) if n > 0 else []\n    ans = find_median_sorted_arrays(nums1, nums2)\n    print(f\"{ans:.1f}\")",
        },
        {
          language: Language.CPP,
          boilerPlate:
            "#include <iostream>\n#include <vector>\n#include <iomanip>\n\nusing namespace std;\n\ndouble findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {\n    return 0.0;\n}\n\nint main() {\n    int m, n;\n    if (cin >> m) {\n        vector<int> nums1(m);\n        for (int i = 0; i < m; ++i) cin >> nums1[i];\n        cin >> n;\n        vector<int> nums2(n);\n        for (int i = 0; i < n; ++i) cin >> nums2[i];\n        cout << fixed << setprecision(1) << findMedianSortedArrays(nums1, nums2) << endl;\n    }\n    return 0;\n}",
        },
        {
          language: Language.TYPESCRIPT,
          boilerPlate:
            "function findMedianSortedArrays(nums1: number[], nums2: number[]): number {\n    return 0;\n}\n\nconst fs = require('fs');\nconst lines = fs.readFileSync(0, 'utf-8').trim().split('\\n');\nconst m = parseInt(lines[0]);\nconst nums1 = m > 0 ? lines[1].trim().split(/\\s+/).map(Number) : [];\nconst n = parseInt(lines[2]);\nconst nums2 = n > 0 ? lines[3].trim().split(/\\s+/).map(Number) : [];\nconsole.log(findMedianSortedArrays(nums1, nums2).toFixed(1));",
        },
      ],
      testCases: [
        {
          inputData: "2\n1 3\n1\n2",
          expectedOutput: "2.0",
          isSample: true,
          isHidden: false,
          orderIndex: 0,
          explanation: "Merged array = [1,2,3] and median is 2.0.",
        },
        {
          inputData: "2\n1 2\n2\n3 4",
          expectedOutput: "2.5",
          isSample: true,
          isHidden: false,
          orderIndex: 1,
          explanation:
            "Merged array = [1,2,3,4] and median is (2 + 3) / 2 = 2.5.",
        },
        {
          inputData: "0\n\n1\n1",
          expectedOutput: "1.0",
          isSample: false,
          isHidden: true,
          orderIndex: 2,
        },
      ],
    },
    {
      title: "Trapping Rain Water",
      slug: "trapping-rain-water",
      difficulty: Difficulty.HARD,
      statement:
        "Given `n` non-negative integers representing an elevation map where the width of each bar is `1`, compute how much water it can trap after raining.",
      inputFormat:
        "First line contains integer N (number of bars). Second line contains N space-separated non-negative integers.",
      outputFormat:
        "A single integer denoting the total units of trapped rain water.",
      constraints:
        "n == height.length\n1 <= n <= 2 * 10^4\n0 <= height[i] <= 10^5",
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      isPublished: true,
      totalAccepted: 410,
      totalSubmissions: 910,
      acceptanceRate: 45.0,
      tags: ["Arrays", "Two Pointers", "Stack", "Dynamic Programming"],
      templates: [
        {
          language: Language.PYTHON,
          boilerPlate:
            "def trap_water(height: list[int]) -> int:\n    pass\n\nif __name__ == '__main__':\n    import sys\n    lines = sys.stdin.read().splitlines()\n    if lines:\n        height = list(map(int, lines[1].split()))\n        print(trap_water(height))",
        },
        {
          language: Language.CPP,
          boilerPlate:
            "#include <iostream>\n#include <vector>\n\nusing namespace std;\n\nint trap(vector<int>& height) {\n    return 0;\n}\n\nint main() {\n    int n;\n    if (cin >> n) {\n        vector<int> h(n);\n        for (int i = 0; i < n; ++i) cin >> h[i];\n        cout << trap(h) << endl;\n    }\n    return 0;\n}",
        },
        {
          language: Language.TYPESCRIPT,
          boilerPlate:
            "function trap(height: number[]): number {\n    return 0;\n}\n\nconst fs = require('fs');\nconst lines = fs.readFileSync(0, 'utf-8').trim().split('\\n');\nif (lines.length >= 2) {\n    const h = lines[1].trim().split(/\\s+/).map(Number);\n    console.log(trap(h));\n}",
        },
      ],
      testCases: [
        {
          inputData: "12\n0 1 0 2 1 0 1 3 2 1 2 1",
          expectedOutput: "6",
          isSample: true,
          isHidden: false,
          orderIndex: 0,
          explanation: "6 units of rain water are being trapped.",
        },
        {
          inputData: "6\n4 2 0 3 2 5",
          expectedOutput: "9",
          isSample: true,
          isHidden: false,
          orderIndex: 1,
        },
        {
          inputData: "3\n2 0 2",
          expectedOutput: "2",
          isSample: false,
          isHidden: true,
          orderIndex: 2,
        },
      ],
    },
    {
      title: "Binary Tree Maximum Path Sum",
      slug: "binary-tree-maximum-path-sum",
      difficulty: Difficulty.HARD,
      statement:
        "A path in a binary tree is a sequence of nodes where each pair of adjacent nodes in the sequence has an edge connecting them. A node can only appear in the sequence at most once. Note that the path does not need to pass through the root.\n\nThe path sum of a path is the sum of the node's values in the path.\n\nGiven the `root` of a binary tree represented as level-order traversal with 'null' for missing nodes, return the maximum path sum of any non-empty path.",
      inputFormat:
        "A single line containing space-separated node values in level-order (or 'null').",
      outputFormat: "A single integer denoting the maximum path sum.",
      constraints:
        "The number of nodes in the tree is in the range [1, 3 * 10^4].\n-1000 <= Node.val <= 1000",
      timeLimitMs: 1000,
      memoryLimitMb: 256,
      isPublished: true,
      totalAccepted: 280,
      totalSubmissions: 720,
      acceptanceRate: 38.8,
      tags: ["Trees", "Dynamic Programming", "Depth-First Search"],
      templates: [
        {
          language: Language.PYTHON,
          boilerPlate:
            "# Definition for a binary tree node.\n# class TreeNode:\n#     def __init__(self, val=0, left=None, right=None):\n#         self.val = val\n#         self.left = left\n#         self.right = right\n\ndef max_path_sum(values: list[str]) -> int:\n    pass",
        },
        {
          language: Language.CPP,
          boilerPlate:
            "#include <iostream>\n#include <string>\n#include <vector>\n\nusing namespace std;\n\nint maxPathSum(vector<string>& treeNodes) {\n    return 0;\n}",
        },
        {
          language: Language.TYPESCRIPT,
          boilerPlate:
            "function maxPathSum(nodes: (number | null)[]): number {\n    return 0;\n}",
        },
      ],
      testCases: [
        {
          inputData: "1 2 3",
          expectedOutput: "6",
          isSample: true,
          isHidden: false,
          orderIndex: 0,
          explanation:
            "The optimal path is 2 -> 1 -> 3 with a path sum of 2 + 1 + 3 = 6.",
        },
        {
          inputData: "-10 9 20 null null 15 7",
          expectedOutput: "42",
          isSample: true,
          isHidden: false,
          orderIndex: 1,
          explanation:
            "The optimal path is 15 -> 20 -> 7 with a path sum of 15 + 20 + 7 = 42.",
        },
        {
          inputData: "-3",
          expectedOutput: "-3",
          isSample: false,
          isHidden: true,
          orderIndex: 2,
        },
      ],
    },
  ];

  // 3. Upsert Problems, Tags, TestCases, Templates
  for (const prob of problemsData) {
    const problem = await prisma.problem.upsert({
      where: { slug: prob.slug },
      update: {
        title: prob.title,
        difficulty: prob.difficulty,
        statement: prob.statement,
        inputFormat: prob.inputFormat,
        outputFormat: prob.outputFormat,
        constraints: prob.constraints,
        timeLimitMs: prob.timeLimitMs,
        memoryLimitMb: prob.memoryLimitMb,
        isPublished: prob.isPublished,
        totalAccepted: prob.totalAccepted,
        totalSubmissions: prob.totalSubmissions,
        acceptanceRate: prob.acceptanceRate,
      },
      create: {
        title: prob.title,
        slug: prob.slug,
        difficulty: prob.difficulty,
        statement: prob.statement,
        inputFormat: prob.inputFormat,
        outputFormat: prob.outputFormat,
        constraints: prob.constraints,
        timeLimitMs: prob.timeLimitMs,
        memoryLimitMb: prob.memoryLimitMb,
        isPublished: prob.isPublished,
        totalAccepted: prob.totalAccepted,
        totalSubmissions: prob.totalSubmissions,
        acceptanceRate: prob.acceptanceRate,
      },
    });

    // Handle Tags
    for (const tagName of prob.tags) {
      const tagSlug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const tag = await prisma.tag.upsert({
        where: { slug: tagSlug },
        update: { name: tagName },
        create: { name: tagName, slug: tagSlug },
      });

      await prisma.problemTag.upsert({
        where: {
          problemId_tagId: {
            problemId: problem.id,
            tagId: tag.id,
          },
        },
        update: {},
        create: {
          problemId: problem.id,
          tagId: tag.id,
        },
      });
    }

    // Handle Templates
    for (const tpl of prob.templates) {
      await prisma.languageTemplate.upsert({
        where: {
          problemId_language: {
            problemId: problem.id,
            language: tpl.language,
          },
        },
        update: { boilerPlate: tpl.boilerPlate },
        create: {
          problemId: problem.id,
          language: tpl.language,
          boilerPlate: tpl.boilerPlate,
        },
      });
    }

    // Handle Test Cases
    // Delete existing test cases to prevent duplicate test cases on re-seed
    await prisma.testCase.deleteMany({ where: { problemId: problem.id } });
    for (const tc of prob.testCases) {
      await prisma.testCase.create({
        data: {
          problemId: problem.id,
          inputData: tc.inputData,
          expectedOutput: tc.expectedOutput,
          isSample: tc.isSample,
          isHidden: tc.isHidden,
          orderIndex: tc.orderIndex,
          explanation: tc.explanation,
        },
      });
    }

    console.log(
      `Seeded problem: [${prob.difficulty}] ${prob.title} (${prob.testCases.length} test cases)`,
    );
  }

  console.log("Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
